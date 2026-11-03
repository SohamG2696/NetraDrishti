from pathlib import Path

import torch
from torch import nn
from torchvision.models import efficientnet_b0, resnet50, swin_t
from torchvision import transforms
from PIL import Image, ImageOps


BASE_DIR = Path(__file__).resolve().parent.parent
DEVICE = torch.device(
    "xpu" if torch.xpu.is_available() else "cpu"
)


class NetraDrishtiPredictor:
    def __init__(self):
        # Fundus ensemble loading
        fundus_path = BASE_DIR / "models" / "netradrishti_fundus_ensemble.pth"

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
        oct_path = BASE_DIR / "models" / "swin_tiny_epoch3.pth"
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

    def preprocess_oct(self, image: Image.Image) -> torch.Tensor:
        image = image.convert("L")
        image.thumbnail((256, 256), Image.Resampling.LANCZOS)

        tensor = self.oct_to_tensor(image)
        tensor = self.oct_normalize(tensor.repeat(3, 1, 1))

        padded = torch.zeros((3, 256, 256), dtype=tensor.dtype)
        h, w = tensor.shape[1:]
        y = (256 - h) // 2
        x = (256 - w) // 2
        padded[:, y:y + h, x:x + w] = tensor

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
