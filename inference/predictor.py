import os
from pathlib import Path
from typing import Optional, Tuple

import torch
from torch import nn
from torchvision.models import efficientnet_b0, resnet50, swin_t
from torchvision import transforms
from PIL import Image, ImageOps

from inference.gradcam import SwinOCTGradCAM, FundusEnsembleGradCAM


BASE_DIR = Path(__file__).resolve().parent.parent


def resolve_device() -> torch.device:
    requested = os.getenv("NETRADRISHTI_DEVICE", "").strip().lower()
    has_xpu = hasattr(torch, "xpu") and torch.xpu.is_available()
    if requested == "cpu":
        return torch.device("cpu")
    if requested == "xpu":
        return torch.device("xpu" if has_xpu else "cpu")
    return torch.device("xpu" if has_xpu else "cpu")


DEVICE = resolve_device()


class NetraDrishtiPredictor:
    def __init__(self, model_dir: Optional[Path] = None):
        resolved_dir = Path(model_dir or os.getenv("MODEL_DIR", BASE_DIR / "models"))
        self.model_dir = resolved_dir
        self.device = DEVICE

        # Fundus ensemble loading
        fundus_path = resolved_dir / "netradrishti_fundus_ensemble.pth"
        if not fundus_path.exists():
            raise FileNotFoundError(
                f"Required Fundus checkpoint missing: {fundus_path.name}"
            )

        checkpoint = torch.load(
            fundus_path,
            map_location="cpu",
            weights_only=True
        )

        self.diseases = checkpoint["diseases"]
        self.thresholds = torch.tensor(
            checkpoint["thresholds"], device=DEVICE
        )
        self.eff_weight = checkpoint["efficientnet_weight"]
        self.res_weight = checkpoint["resnet_weight"]

        self.efficientnet = efficientnet_b0(weights=None)
        self.efficientnet.classifier[1] = nn.Linear(
            1280, len(self.diseases)
        )
        self.efficientnet.load_state_dict(
            checkpoint["efficientnet_state"]
        )
        self.efficientnet = self.efficientnet.to(DEVICE).eval()

        self.resnet = resnet50(weights=None)
        self.resnet.fc = nn.Linear(
            2048, len(self.diseases)
        )
        self.resnet.load_state_dict(checkpoint["resnet_state"])
        self.resnet = self.resnet.to(DEVICE).eval()

        size = checkpoint["image_size"]
        self.fundus_image_size = size

        self.transform = transforms.Compose([
            transforms.Lambda(
                lambda img: ImageOps.pad(
                    img, (size, size),
                    method=Image.Resampling.LANCZOS,
                    color=(0, 0, 0)
                )
            ),
            transforms.ToTensor(),
            transforms.Normalize(
                mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]
            )
        ])

        # OCT Swin-Tiny loading
        oct_path = resolved_dir / "swin_tiny_epoch3.pth"
        if not oct_path.exists():
            raise FileNotFoundError(
                f"Required OCT checkpoint missing: {oct_path.name}"
            )
        oct_checkpoint = torch.load(
            oct_path,
            map_location="cpu",
            weights_only=True
        )

        self.oct_class_to_idx = oct_checkpoint["class_to_idx"]
        self.oct_idx_to_class = {
            v: k for k, v in self.oct_class_to_idx.items()
        }
        self.oct_classes = [
            self.oct_idx_to_class[i] for i in range(len(self.oct_class_to_idx))
        ]

        self.oct_model = swin_t(weights=None)
        self.oct_model.head = nn.Linear(768, len(self.oct_classes))
        self.oct_model.load_state_dict(oct_checkpoint["model_state_dict"])
        self.oct_model = self.oct_model.to(DEVICE).eval()

        self.oct_normalize = transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225]
        )
        self.oct_to_tensor = transforms.ToTensor()

        # Real Grad-CAM explainers reusing the already-loaded model instances
        self.oct_gradcam = SwinOCTGradCAM(self.oct_model)
        self.fundus_gradcam = FundusEnsembleGradCAM(
            efficientnet=self.efficientnet,
            resnet=self.resnet,
            eff_weight=self.eff_weight,
            res_weight=self.res_weight,
            image_size=size,
        )

    def preprocess_oct_with_box(
        self, image: Image.Image
    ) -> Tuple[torch.Tensor, Tuple[int, int, int, int]]:
        image = image.convert("L")
        image.thumbnail((256, 256), Image.Resampling.LANCZOS)

        tensor = self.oct_to_tensor(image)
        tensor = self.oct_normalize(tensor.repeat(3, 1, 1))

        padded = torch.zeros((3, 256, 256), dtype=tensor.dtype)
        h, w = tensor.shape[1:]
        y = (256 - h) // 2
        x = (256 - w) // 2
        padded[:, y:y + h, x:x + w] = tensor

        return padded, (y, x, h, w)

    def preprocess_oct(self, image: Image.Image) -> torch.Tensor:
        padded, _ = self.preprocess_oct_with_box(image)
        return padded

    @torch.inference_mode()
    def predict_oct(self, image: Image.Image):
        x = self.preprocess_oct(image).unsqueeze(0).to(DEVICE)
        logits = self.oct_model(x)
        probabilities = torch.softmax(logits, dim=1)[0]

        predicted_idx = int(torch.argmax(probabilities).item())
        predicted_class = self.oct_idx_to_class[predicted_idx]

        scores = {
            cls: round(float(probabilities[self.oct_class_to_idx[cls]].item()), 4)
            for cls in self.oct_classes
        }

        return {
            "predicted_class": predicted_class,
            "prediction": predicted_class,
            "confidence": scores[predicted_class],
            "scores": scores
        }

    @torch.inference_mode()
    def predict_fundus(self, image: Image.Image):
        image = image.convert("RGB")
        x = self.transform(image).unsqueeze(0).to(DEVICE)

        eff_scores = torch.sigmoid(self.efficientnet(x))
        res_scores = torch.sigmoid(self.resnet(x))

        scores = (
            self.eff_weight * eff_scores
            + self.res_weight * res_scores
        )[0]

        return {
            disease: {
                "score": round(float(scores[i].item()), 4),
                "threshold": round(float(self.thresholds[i].item()), 4),
                "detected": bool(scores[i] >= self.thresholds[i])
            }
            for i, disease in enumerate(self.diseases)
        }

    def explain_oct(
        self, image: Image.Image, target_class: Optional[str] = None
    ):
        orig_gray = image.convert("L")
        tensor, box = self.preprocess_oct_with_box(orig_gray)
        x = tensor.unsqueeze(0).to(DEVICE)

        # Compute exact class scores first under inference_mode
        pred = self.predict_oct(image)
        predicted_class = pred["predicted_class"]

        if target_class:
            normalized_target = target_class.strip().upper()
            if normalized_target not in self.oct_class_to_idx:
                raise ValueError(
                    f"Unknown OCT class '{target_class}'. Valid classes: {self.oct_classes}"
                )
            selected_class = normalized_target
        else:
            selected_class = predicted_class

        target_idx = self.oct_class_to_idx[selected_class]
        cam_out = self.oct_gradcam.generate(x, target_idx, box, orig_gray)

        return {
            "modality": "OCT",
            "predicted_class": predicted_class,
            "selected_class": selected_class,
            "confidence": pred["confidence"],
            "selected_score": pred["scores"][selected_class],
            "scores": pred["scores"],
            "heatmap": cam_out.heatmap_data_url,
            "overlay": cam_out.overlay_data_url,
            "explanation_meta": cam_out.grad_stats,
        }

    def explain_fundus(
        self, image: Image.Image, target_disease: Optional[str] = None
    ):
        orig_rgb = image.convert("RGB")
        x = self.transform(orig_rgb).unsqueeze(0).to(DEVICE)

        # Compute exact predictions under inference_mode
        predictions = self.predict_fundus(orig_rgb)

        if target_disease:
            normalized_disease = target_disease.strip().upper()
            if normalized_disease not in self.diseases:
                raise ValueError(
                    f"Unknown Fundus disease '{target_disease}'. Valid diseases: {self.diseases}"
                )
            selected_disease = normalized_disease
        else:
            detected = [
                (d, predictions[d]["score"])
                for d in self.diseases
                if predictions[d]["detected"]
            ]
            if detected:
                selected_disease = max(detected, key=lambda item: item[1])[0]
            else:
                selected_disease = max(
                    self.diseases, key=lambda d: predictions[d]["score"]
                )

        disease_idx = self.diseases.index(selected_disease)
        cam_res = self.fundus_gradcam.generate(x, disease_idx, orig_rgb)

        return {
            "modality": "Fundus",
            "selected_disease": selected_disease,
            "selected_score": predictions[selected_disease]["score"],
            "selected_threshold": predictions[selected_disease]["threshold"],
            "selected_detected": predictions[selected_disease]["detected"],
            "predictions": predictions,
            "efficientnet_heatmap": cam_res["efficientnet_heatmap"],
            "resnet_heatmap": cam_res["resnet_heatmap"],
            "combined_heatmap": cam_res["combined_heatmap"],
            "combined_overlay": cam_res["combined_overlay"],
            "model_weights": {
                "efficientnet": self.eff_weight,
                "resnet": self.res_weight,
            },
            "explanation_meta": cam_res["metadata"],
        }
