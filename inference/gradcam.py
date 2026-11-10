"""
Real Gradient-Weighted Class Activation Mapping (Grad-CAM) for NetraDrishti.

Implements:
1. SwinOCTGradCAM — Swin-Tiny compatible Grad-CAM targeting the final spatial
   SwinTransformerBlock (features.7.1) before global pooling, with channel-last
   to channel-first permutation and artificial-padding masking.
2. FundusEnsembleGradCAM — Multilabel Grad-CAM for EfficientNet-B0 (features.8)
   and ResNet-50 (layer4.2), plus weighted visualization combining both
   normalized probability-target heatmaps using saved ensemble weights.
"""

import base64
import io
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image, ImageOps


def _compute_pad_box(orig_size: Tuple[int, int], target_size: int) -> Tuple[int, int, int, int]:
    """
    Compute exact content bounding box (y, x, h, w) inside a padded square canvas
    produced by PIL ImageOps.pad / thumbnail centering.
    """
    orig_w, orig_h = orig_size
    scale = min(target_size / orig_w, target_size / orig_h)
    new_w = max(1, min(target_size, round(orig_w * scale)))
    new_h = max(1, min(target_size, round(orig_h * scale)))
    x = round((target_size - new_w) * 0.5) if new_w != target_size else 0
    y = round((target_size - new_h) * 0.5) if new_h != target_size else 0
    return int(y), int(x), int(new_h), int(new_w)


def _display_dimensions(orig_size: Tuple[int, int], max_edge: int = 512) -> Tuple[int, int]:
    """Return (width, height) preserving original aspect ratio, capped at max_edge."""
    w, h = orig_size
    scale = min(1.0, max_edge / max(w, h))
    return max(1, round(w * scale)), max(1, round(h * scale))


def _render_heatmap_and_overlay(
    cam_padded: torch.Tensor,
    box: Tuple[int, int, int, int],
    orig_rgb: Image.Image,
    alpha: float = 0.45,
) -> Tuple[str, str, Dict[str, float]]:
    """
    Mask padded borders, normalize inside the retinal tissue bounding box,
    crop to active content, resize to match original aspect ratio, and encode
    as lossless base64 PNG data URLs.
    """
    y, x, h, w = box
    canvas_size = cam_padded.shape[-1]

    # Mask out artificial padded border outside [y:y+h, x:x+w]
    masked = torch.zeros_like(cam_padded)
    active = cam_padded[y : y + h, x : x + w]
    a_min = float(active.min().item())
    a_max = float(active.max().item())
    if a_max - a_min > 1e-8:
        active_norm = (active - a_min) / (a_max - a_min)
    else:
        active_norm = torch.zeros_like(active)
    masked[y : y + h, x : x + w] = active_norm

    # Verify padded region is strictly zeroed
    pad_mask = torch.ones((canvas_size, canvas_size), dtype=torch.bool)
    pad_mask[y : y + h, x : x + w] = False
    pad_max = float(masked[pad_mask].max().item()) if pad_mask.any() else 0.0

    stats = {
        "active_min": round(float(active_norm.min().item()), 4),
        "active_max": round(float(active_norm.max().item()), 4),
        "active_mean": round(float(active_norm.mean().item()), 4),
        "active_std": round(float(active_norm.std().item()), 4),
        "pad_max_after_masking": round(pad_max, 6),
    }

    # Crop active tissue region and resize to match original image aspect ratio
    disp_w, disp_h = _display_dimensions(orig_rgb.size, max_edge=512)
    active_np = active_norm.cpu().numpy().astype(np.float32)
    cam_resized = cv2.resize(active_np, (disp_w, disp_h), interpolation=cv2.INTER_LINEAR)
    cam_resized = np.clip(cam_resized, 0.0, 1.0)

    heatmap_bgr = cv2.applyColorMap(np.uint8(np.round(255.0 * cam_resized)), cv2.COLORMAP_JET)
    heatmap_rgb = cv2.cvtColor(heatmap_bgr, cv2.COLOR_BGR2RGB)

    orig_disp = np.array(orig_rgb.resize((disp_w, disp_h), Image.Resampling.LANCZOS))
    overlay_rgb = cv2.addWeighted(orig_disp, 1.0 - alpha, heatmap_rgb, alpha, 0)

    return _encode_png_data_url(heatmap_rgb), _encode_png_data_url(overlay_rgb), stats


def _encode_png_data_url(rgb_array: np.ndarray) -> str:
    img = Image.fromarray(rgb_array.astype(np.uint8))
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{b64}"


@dataclass
class SwinGradCAMOutput:
    cam_padded: torch.Tensor
    logits: torch.Tensor
    heatmap_data_url: str
    overlay_data_url: str
    grad_stats: Dict[str, Any]


class SwinOCTGradCAM:
    """
    Grad-CAM engine tailored to torchvision Swin-Tiny (swin_t).

    Targets `model.features[-1][-1]` (the final SwinTransformerBlock before
    `model.norm`). Unlike `model.norm`, whose subsequent global average pooling
    and linear classifier cause spatially uniform gradients (zero spatial std),
    `features[-1][-1]` preserves non-zero spatial gradient variation across the
    8x8 token grid while capturing deep semantic retinal patterns.
    """

    def __init__(self, model: nn.Module):
        self.model = model
        self.target_layer = model.features[-1][-1]
        self.target_layer_name = "features.7.1 (Final SwinTransformerBlock)"

    def generate(
        self,
        input_tensor: torch.Tensor,
        target_class_idx: int,
        content_box: Tuple[int, int, int, int],
        orig_gray_image: Image.Image,
    ) -> SwinGradCAMOutput:
        captured: Dict[str, torch.Tensor] = {}

        def forward_hook(_module: nn.Module, _inp: Any, out: torch.Tensor) -> None:
            captured["activations"] = out

        handle = self.target_layer.register_forward_hook(forward_hook)
        try:
            with torch.enable_grad():
                self.model.zero_grad(set_to_none=True)
                x = input_tensor.detach().clone().requires_grad_(True)
                logits = self.model(x)
                target_score = logits[0, target_class_idx]
                act = captured["activations"]
                grad = torch.autograd.grad(target_score, act, retain_graph=False)[0]

                # Swin output layout is channel-last: [B, H, W, C] -> [B, C, H, W]
                act_nchw = act.detach().permute(0, 3, 1, 2)
                grad_nchw = grad.detach().permute(0, 3, 1, 2)

                if not torch.isfinite(grad_nchw).all():
                    raise RuntimeError("Non-finite gradients encountered during Swin Grad-CAM.")

                weights = grad_nchw.mean(dim=(2, 3), keepdim=True)
                cam = F.relu((weights * act_nchw).sum(dim=1, keepdim=True))
                cam_up = F.interpolate(
                    cam, size=(256, 256), mode="bilinear", align_corners=False
                )[0, 0]

                grad_abs_mean = float(grad_nchw.abs().mean().item())
                grad_spatial_std = float(grad_nchw.std(dim=(2, 3)).mean().item())

                orig_rgb = orig_gray_image.convert("RGB")
                heatmap_url, overlay_url, cam_stats = _render_heatmap_and_overlay(
                    cam_up, content_box, orig_rgb, alpha=0.45
                )

                grad_stats = {
                    "target_layer": self.target_layer_name,
                    "feature_map_shape": list(act_nchw.shape),
                    "grad_abs_mean": round(grad_abs_mean, 8),
                    "grad_spatial_std": round(grad_spatial_std, 8),
                    "finite_gradients": True,
                    "content_box_256": list(content_box),
                    "pad_masked": True,
                    **cam_stats,
                }
                return SwinGradCAMOutput(
                    cam_padded=cam_up.detach(),
                    logits=logits.detach(),
                    heatmap_data_url=heatmap_url,
                    overlay_data_url=overlay_url,
                    grad_stats=grad_stats,
                )
        finally:
            handle.remove()
            captured.clear()
            self.model.zero_grad(set_to_none=True)


class FundusEnsembleGradCAM:
    """
    Multilabel Grad-CAM engine for the EfficientNet-B0 + ResNet-50 Fundus ensemble.

    Computes disease-specific Grad-CAM individually for EfficientNet-B0
    (`features[-1]`) and ResNet-50 (`layer4[-1]`) using each model's disease
    probability as the gradient target (falling back to logit only if sigmoid
    derivative saturates below 1e-7). Individual normalized maps are then blended
    using the saved ensemble weights (e.g. 0.5 / 0.5) without double-weighting.
    """

    def __init__(
        self,
        efficientnet: nn.Module,
        resnet: nn.Module,
        eff_weight: float,
        res_weight: float,
        image_size: int = 320,
    ):
        self.efficientnet = efficientnet
        self.resnet = resnet
        self.eff_weight = float(eff_weight)
        self.res_weight = float(res_weight)
        self.image_size = int(image_size)
        self.eff_layer = efficientnet.features[-1]
        self.res_layer = resnet.layer4[-1]

    def _single_cnn_gradcam(
        self,
        model: nn.Module,
        target_layer: nn.Module,
        x_in: torch.Tensor,
        disease_idx: int,
    ) -> Tuple[torch.Tensor, torch.Tensor, Dict[str, Any]]:
        captured: Dict[str, torch.Tensor] = {}

        def forward_hook(_module: nn.Module, _inp: Any, out: torch.Tensor) -> None:
            captured["activations"] = out

        handle = target_layer.register_forward_hook(forward_hook)
        try:
            with torch.enable_grad():
                model.zero_grad(set_to_none=True)
                x = x_in.detach().clone().requires_grad_(True)
                logits = model(x)
                logit = logits[0, disease_idx]
                prob = torch.sigmoid(logit)

                # Prefer probability target; fallback to raw logit only if saturated
                p_val = float(prob.item())
                if p_val * (1.0 - p_val) >= 1e-7:
                    target = prob
                    target_type = "sigmoid_probability"
                else:
                    target = logit
                    target_type = "logit_fallback_saturated"

                act = captured["activations"]
                grad = torch.autograd.grad(target, act, retain_graph=False)[0]
                act_det = act.detach()
                grad_det = grad.detach()

                if not torch.isfinite(grad_det).all():
                    raise RuntimeError("Non-finite gradients encountered during CNN Grad-CAM.")

                weights = grad_det.mean(dim=(2, 3), keepdim=True)
                cam = F.relu((weights * act_det).sum(dim=1, keepdim=True))
                cam_up = F.interpolate(
                    cam,
                    size=(self.image_size, self.image_size),
                    mode="bilinear",
                    align_corners=False,
                )[0, 0]

                meta = {
                    "target_type": target_type,
                    "feature_map_shape": list(act_det.shape),
                    "grad_abs_mean": round(float(grad_det.abs().mean().item()), 8),
                    "finite_gradients": True,
                }
                return cam_up, torch.sigmoid(logits).detach(), meta
        finally:
            handle.remove()
            captured.clear()
            model.zero_grad(set_to_none=True)

    @staticmethod
    def _normalize_in_box(cam_padded: torch.Tensor, box: Tuple[int, int, int, int]) -> torch.Tensor:
        y, x, h, w = box
        masked = torch.zeros_like(cam_padded)
        active = cam_padded[y : y + h, x : x + w]
        a_min, a_max = float(active.min().item()), float(active.max().item())
        if a_max - a_min > 1e-8:
            masked[y : y + h, x : x + w] = (active - a_min) / (a_max - a_min)
        return masked

    def generate(
        self,
        input_tensor: torch.Tensor,
        disease_idx: int,
        orig_rgb: Image.Image,
    ) -> Dict[str, Any]:
        box = _compute_pad_box(orig_rgb.size, self.image_size)

        cam_eff_raw, eff_scores, eff_meta = self._single_cnn_gradcam(
            self.efficientnet, self.eff_layer, input_tensor, disease_idx
        )
        cam_res_raw, res_scores, res_meta = self._single_cnn_gradcam(
            self.resnet, self.res_layer, input_tensor, disease_idx
        )

        # Normalize individual CAMs within active image content before weighted blending
        cam_eff_norm = self._normalize_in_box(cam_eff_raw, box)
        cam_res_norm = self._normalize_in_box(cam_res_raw, box)

        cam_combined_raw = self.eff_weight * cam_eff_norm + self.res_weight * cam_res_norm
        cam_combined_norm = self._normalize_in_box(cam_combined_raw, box)

        eff_url, _, eff_stats = _render_heatmap_and_overlay(cam_eff_norm, box, orig_rgb, alpha=0.45)
        res_url, _, res_stats = _render_heatmap_and_overlay(cam_res_norm, box, orig_rgb, alpha=0.45)
        comb_url, comb_overlay_url, comb_stats = _render_heatmap_and_overlay(
            cam_combined_norm, box, orig_rgb, alpha=0.45
        )

        ensemble_scores = (self.eff_weight * eff_scores + self.res_weight * res_scores)[0]

        return {
            "ensemble_scores": ensemble_scores,
            "efficientnet_heatmap": eff_url,
            "resnet_heatmap": res_url,
            "combined_heatmap": comb_url,
            "combined_overlay": comb_overlay_url,
            "metadata": {
                "method": "Per-backbone Grad-CAM combined via saved probability ensemble weights",
                "explanation_note": (
                    "The combined map is a weighted visualization of normalized individual "
                    "EfficientNet-B0 and ResNet-50 Grad-CAM maps, not a direct joint gradient "
                    "of the full ensemble graph."
                ),
                "efficientnet_target_layer": "features.8 (Conv2dNormActivation 1280-ch)",
                "resnet_target_layer": "layer4.2 (Final Bottleneck 2048-ch)",
                "efficientnet_weight": self.eff_weight,
                "resnet_weight": self.res_weight,
                "content_box_320": list(box),
                "efficientnet_stats": {**eff_meta, **eff_stats},
                "resnet_stats": {**res_meta, **res_stats},
                "combined_stats": comb_stats,
            },
        }

