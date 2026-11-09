# NetraDrishti — Model Checkpoints Directory

This directory houses the trained PyTorch deep learning weights utilized by the NetraDrishti unified inference pipeline (`inference/predictor.py`).

> [!NOTE]
> Due to GitHub's file size limitations, trained model weights (`*.pth`) are excluded from Git tracking via `.gitignore`. The files must be present locally in this directory for the backend and inference engine to function.

---

## 1. Required Model Checkpoints

| Filename | Architecture | Modality | Output Classes / Tasks | Approximate Size |
|---|---|---|---|---|
| `swin_tiny_epoch3.pth` | Swin Transformer Tiny (`swin_t`) | OCT Tomography (Grayscale B-Scans) | 4-Class Classification (`CNV`, `DME`, `DRUSEN`, `NORMAL`) | ~330 MB |
| `netradrishti_fundus_ensemble.pth` | 50/50 Ensemble: EfficientNet-B0 + ResNet-50 | Color Fundus Photography (RGB) | 8-Class Multi-Label (`DR`, `MH`, `ODC`, `TSLN`, `DN`, `MYA`, `ARMD`, `BRVO`) | ~111 MB |

---

## 2. Checkpoint Details & Expected Structure

```text
models/
├── README.md                           # This documentation file
├── swin_tiny_epoch3.pth                # Trained Swin-Tiny OCT weights (local only)
├── netradrishti_fundus_ensemble.pth    # Trained Fundus ensemble weights (local only)
├── train_manifest.csv                  # Training manifest
└── val_manifest.csv                    # Validation manifest
```

### `swin_tiny_epoch3.pth`
- **Architecture**: `torchvision.models.swin_t(weights=None)` with classification head `nn.Linear(768, 4)`.
- **Checkpoint Keys**:
  - `model_state_dict`: Model weights for all transformer stages and classification head.
  - `class_to_idx`: Mapping `{'CNV': 0, 'DME': 1, 'DRUSEN': 2, 'NORMAL': 3}`.
  - `epoch`: `3`.
  - `val_acc`: `0.9502` (~95.02% validation accuracy on Kermany dataset).
- **Preprocessing Pipeline**: Input converted to grayscale, aspect-ratio resized to $(256, 256)$ via Lanczos thumbnailing, repeated across 3 channels, ImageNet normalized ($\mu = [0.485, 0.456, 0.406]$, $\sigma = [0.229, 0.224, 0.225]$), and zero-padded to $(3, 256, 256)$.

### `netradrishti_fundus_ensemble.pth`
- **Architecture**:
  - Backbone 1: `torchvision.models.efficientnet_b0(weights=None)` with classifier `nn.Linear(1280, 8)`.
  - Backbone 2: `torchvision.models.resnet50(weights=None)` with fc `nn.Linear(2048, 8)`.
- **Ensemble Policy**: 50/50 weighted combination ($0.5 \times \text{EffNet} + 0.5 \times \text{ResNet}$).
- **Checkpoint Keys**:
  - `efficientnet_state`: State dict for EfficientNet-B0.
  - `resnet_state`: State dict for ResNet-50.
  - `diseases`: `['DR', 'MH', 'ODC', 'TSLN', 'DN', 'MYA', 'ARMD', 'BRVO']`.
  - `thresholds`: Calibrated decision cutoffs per disease optimized for multi-label F1 on RFMiD validation.
  - `image_size`: `320`.
  - `efficientnet_weight`: `0.5`.
  - `resnet_weight`: `0.5`.

---

## 3. How to Obtain and Place Checkpoints

If setting up this repository on a fresh machine or collaborator workstation:

1. Obtain the authorized checkpoint files from the project maintainers or institutional storage.
2. Verify that the files match the required names:
   - `swin_tiny_epoch3.pth`
   - `netradrishti_fundus_ensemble.pth`
3. Place both `.pth` files directly into this `models/` directory.
4. Verify readiness by starting the backend and requesting `GET /api/health`:
   ```bash
   curl http://localhost:8000/api/health
   ```
   The response will confirm `models_ready: true`.

