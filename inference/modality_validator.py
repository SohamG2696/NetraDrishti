"""
Retinal Image Modality Guardrail Validator for NetraDrishti.

Screens uploaded images before running OCT or Fundus disease classifiers using
out-of-distribution (OOD) aware feature geometry in an ImageNet-pretrained
EfficientNet-B0 embedding space (1280-D -> PCA-128):
  - L2-normalized centroid cosine similarity (oct / fundus)
  - Regularized Ledoit-Wolf Mahalanobis distance in PCA-128 space
  - Calibrated OCT-vs-Fundus logistic discriminator with abstention margin

Returns a conservative three-way decision: "oct", "fundus", or "unknown".

Limitations (Honest Engineering Disclosure):
  - Calibrated on Kermany OCT and RFMiD Fundus distributions and verified on
    held-out OCT/Fundus test splits plus available non-retinal / microscopy OOD
    examples. Because no massive multi-domain medical OOD dataset (e.g., X-ray,
    MRI, slit-lamp) was available locally for negative calibration, this guardrail
    is flagged as provisional and prioritizes conservative abstention ("unknown").
  - Passing this validator does NOT guarantee clinical diagnostic image quality.
"""

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
import torch
import torch.nn as nn
from PIL import Image, ImageOps
from torchvision import transforms
from torchvision.models import efficientnet_b0

BASE_DIR = Path(__file__).resolve().parent.parent
BACKBONE_FILENAME = "efficientnet_b0_rwightman-7f5810bc.pth"


def resolve_stats_path(model_dir: Optional[Path] = None) -> Path:
    resolved_dir = Path(model_dir or os.getenv("MODEL_DIR", BASE_DIR / "models"))
    candidate = resolved_dir / "modality_validator_stats.npz"
    if candidate.exists():
        return candidate
    return BASE_DIR / "models" / "modality_validator_stats.npz"


def resolve_backbone_path(model_dir: Optional[Path] = None) -> Path:
    explicit = os.getenv("MODALITY_BACKBONE_PATH", "").strip()
    if explicit:
        return Path(explicit)
    resolved_dir = Path(model_dir or os.getenv("MODEL_DIR", BASE_DIR / "models"))
    in_model_dir = resolved_dir / BACKBONE_FILENAME
    if in_model_dir.exists():
        return in_model_dir
    return Path(torch.hub.get_dir()) / "checkpoints" / BACKBONE_FILENAME


@dataclass
class ModalityThresholds:
    oct_max_mahalanobis: float = float(os.getenv("MODALITY_OCT_MAX_MAHAL", "24.0"))
    oct_min_cosine: float = float(os.getenv("MODALITY_OCT_MIN_COSINE", "0.45"))
    oct_min_prob: float = float(os.getenv("MODALITY_OCT_MIN_PROB", "0.90"))
    fundus_max_mahalanobis: float = float(os.getenv("MODALITY_FUN_MAX_MAHAL", "24.0"))
    fundus_min_cosine: float = float(os.getenv("MODALITY_FUN_MIN_COSINE", "0.55"))
    fundus_min_prob: float = float(os.getenv("MODALITY_FUN_MIN_PROB", "0.90"))
    min_cosine_margin: float = float(os.getenv("MODALITY_MIN_COSINE_MARGIN", "0.15"))
    min_image_dim: int = 32
    min_pixel_std: float = 3.0


@dataclass
class ModalityValidationResult:
    detected_modality: str  # "oct" | "fundus" | "unknown"
    reliability: float
    reason: str
    is_provisional: bool
    metrics: Dict[str, Any]


class ModalityValidator:
    """
    Standalone OOD-aware retinal modality validator.
    Never modifies or relies on the downstream disease classifiers' scores.
    """

    def __init__(
        self,
        stats_path: Optional[Path] = None,
        backbone_weights_path: Optional[Path] = None,
        device: Optional[torch.device] = None,
        thresholds: Optional[ModalityThresholds] = None,
        model_dir: Optional[Path] = None,
    ):
        has_xpu = hasattr(torch, "xpu") and torch.xpu.is_available()
        self.device = device or torch.device("xpu" if has_xpu else "cpu")
        self.thresholds = thresholds or ModalityThresholds()
        self.stats_path = Path(stats_path) if stats_path else resolve_stats_path(model_dir)
        self.backbone_weights_path = (
            Path(backbone_weights_path)
            if backbone_weights_path
            else resolve_backbone_path(model_dir)
        )
        self.ready = False
        self.load_error: Optional[str] = None

        self._load_artifacts()

    def _load_artifacts(self) -> None:
        if not self.stats_path.exists():
            self.load_error = f"Modality calibration file missing: {self.stats_path.name}"
            return
        if not self.backbone_weights_path.exists():
            self.load_error = (
                "Cached ImageNet EfficientNet-B0 weights not found locally; "
                "refusing unchecked download."
            )
            return

        # Load calibration statistics safely without pickle
        data = np.load(self.stats_path, allow_pickle=False)
        self.pca_mean = data["pca_mean"].astype(np.float32)
        self.pca_components = data["pca_components"].astype(np.float32)
        self.oct_centroid = data["oct_centroid"].astype(np.float32)
        self.fundus_centroid = data["fundus_centroid"].astype(np.float32)
        self.oct_lw_mean = data["oct_lw_mean"].astype(np.float32)
        self.oct_lw_precision = data["oct_lw_precision"].astype(np.float32)
        self.fundus_lw_mean = data["fundus_lw_mean"].astype(np.float32)
        self.fundus_lw_precision = data["fundus_lw_precision"].astype(np.float32)
        self.lr_coef = data["lr_coef"].astype(np.float32)
        self.lr_intercept = float(data["lr_intercept"][0])

        # Load backbone strictly from local cache
        backbone = efficientnet_b0(weights=None)
        state = torch.load(self.backbone_weights_path, map_location="cpu", weights_only=True)
        backbone.load_state_dict(state)
        backbone.classifier = nn.Identity()
        self.backbone = backbone.to(self.device).eval()

        self.transform = transforms.Compose([
            transforms.Lambda(
                lambda img: ImageOps.pad(
                    img.convert("RGB"),
                    (224, 224),
                    method=Image.Resampling.BILINEAR,
                    color=(0, 0, 0),
                )
            ),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        self.ready = True

    @staticmethod
    def _mahalanobis(vec: np.ndarray, mean: np.ndarray, precision: np.ndarray) -> float:
        diff = vec - mean
        val = float((diff @ precision) @ diff)
        return float(np.sqrt(max(0.0, val)))

    @torch.inference_mode()
    def validate(self, image: Image.Image) -> ModalityValidationResult:
        if not self.ready:
            return ModalityValidationResult(
                detected_modality="unknown",
                reliability=0.0,
                reason=self.load_error or "Modality validator is not initialized.",
                is_provisional=True,
                metrics={},
            )

        # 1. Basic structural sanity gate (rejects blank/tiny images)
        w, h = image.size
        if w < self.thresholds.min_image_dim or h < self.thresholds.min_image_dim:
            return ModalityValidationResult(
                detected_modality="unknown",
                reliability=0.0,
                reason=f"Image dimensions ({w}x{h}) are too small for retinal analysis.",
                is_provisional=True,
                metrics={"width": w, "height": h},
            )

        gray_arr = np.asarray(image.convert("L"), dtype=np.float32)
        pixel_std = float(gray_arr.std())
        if pixel_std < self.thresholds.min_pixel_std:
            return ModalityValidationResult(
                detected_modality="unknown",
                reliability=0.0,
                reason="Image lacks structural contrast (blank or nearly uniform frame).",
                is_provisional=True,
                metrics={"pixel_std": round(pixel_std, 3)},
            )

        # 2. Extract ImageNet embedding & normalize
        x = self.transform(image).unsqueeze(0).to(self.device)
        feat = self.backbone(x).squeeze(0).detach().cpu().numpy().astype(np.float32)
        feat_norm = feat / (float(np.linalg.norm(feat)) + 1e-8)

        # 3. Compute OOD & cross-modality metrics
        cos_oct = float(feat_norm @ self.oct_centroid)
        cos_fun = float(feat_norm @ self.fundus_centroid)
        pca_vec = (feat_norm - self.pca_mean) @ self.pca_components.T
        d_oct = self._mahalanobis(pca_vec, self.oct_lw_mean, self.oct_lw_precision)
        d_fun = self._mahalanobis(pca_vec, self.fundus_lw_mean, self.fundus_lw_precision)

        logit = float(feat_norm @ self.lr_coef + self.lr_intercept)
        p_oct = float(1.0 / (1.0 + np.exp(-np.clip(logit, -50.0, 50.0))))
        p_fun = 1.0 - p_oct

        t = self.thresholds
        is_oct = (
            d_oct <= t.oct_max_mahalanobis
            and cos_oct >= t.oct_min_cosine
            and p_oct >= t.oct_min_prob
            and (cos_oct - cos_fun) >= t.min_cosine_margin
        )
        is_fun = (
            d_fun <= t.fundus_max_mahalanobis
            and cos_fun >= t.fundus_min_cosine
            and p_fun >= t.fundus_min_prob
            and (cos_fun - cos_oct) >= t.min_cosine_margin
        )

        metrics = {
            "oct_cosine": round(cos_oct, 4),
            "fundus_cosine": round(cos_fun, 4),
            "oct_mahalanobis": round(d_oct, 3),
            "fundus_mahalanobis": round(d_fun, 3),
            "oct_vs_fundus_prob": round(p_oct, 4),
        }

        if is_oct and not is_fun:
            dist_factor = max(0.0, 1.0 - (d_oct / (2.0 * t.oct_max_mahalanobis)))
            reliability = round(float(np.clip(0.5 * cos_oct + 0.5 * dist_factor, 0.0, 1.0)), 4)
            return ModalityValidationResult(
                detected_modality="oct",
                reliability=reliability,
                reason="Image embedding aligns with the calibrated retinal OCT manifold.",
                is_provisional=True,
                metrics=metrics,
            )

        if is_fun and not is_oct:
            dist_factor = max(0.0, 1.0 - (d_fun / (2.0 * t.fundus_max_mahalanobis)))
            reliability = round(float(np.clip(0.5 * cos_fun + 0.5 * dist_factor, 0.0, 1.0)), 4)
            return ModalityValidationResult(
                detected_modality="fundus",
                reliability=reliability,
                reason="Image embedding aligns with the calibrated retinal Fundus manifold.",
                is_provisional=True,
                metrics=metrics,
            )

        return ModalityValidationResult(
            detected_modality="unknown",
            reliability=0.0,
            reason=(
                "Image embedding falls outside calibrated OCT and Fundus manifolds "
                "or exhibits ambiguous cross-modality similarity."
            ),
            is_provisional=True,
            metrics=metrics,
        )

