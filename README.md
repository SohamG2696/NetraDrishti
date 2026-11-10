# NetraDrishti — AI-Powered Retinal Disease Analysis

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch%202.x-EE4C2C?style=flat-square&logo=pytorch)](https://pytorch.org/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styles-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**NetraDrishti** is an advanced, dual-modality ophthalmic screening platform designed to assist in retinal disease triage. By integrating hierarchical **Vision Transformers (Swin-Tiny)** for cross-sectional Optical Coherence Tomography (OCT) scans and a **dual-backbone CNN ensemble (EfficientNet-B0 + ResNet-50)** for digital color Fundus photography — combined with **out-of-distribution (OOD) modality validation guardrails** and **real gradient-based Grad-CAM explainability** — NetraDrishti provides transparent, automated retinal pattern analysis.

> [!IMPORTANT]
> **Medical & Research Disclaimer:** NetraDrishti is developed strictly for research, educational, and scientific evaluation purposes. It is **not** certified as a clinical medical device under FDA or CE regulations. Predictions, probability distributions, detection flags, and Grad-CAM heatmaps are algorithmic estimates and must never substitute for professional clinical evaluation by a licensed ophthalmologist or optometrist.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    Client / React 19 + TypeScript      │
                      │  (Modality Toggle, Grad-CAM Overlay)   │
                      └───────────────────┬────────────────────┘
                                          │ Multipart Upload (JPEG/PNG)
                                          ▼
                      ┌────────────────────────────────────────┐
                      │      FastAPI High-Throughput API       │
                      │   - Safe Pillow Decoding (< 25M px)    │
                      │   - 10 MB Stream Size Guard            │
                      │   - Non-Blocking Thread Execution      │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │   Image Modality Validation Guardrail  │
                      │   ImageNet EffNet-B0 PCA-128 Manifold  │
                      │   -> Accepts: oct / fundus             │
                      │   -> Rejects: unknown / wrong (422)    │
                      └───────────────────┬────────────────────┘
                                          │ (Verified Modality Only)
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼ (OCT Mode)                                  ▼ (Fundus Mode)
        ┌─────────────────────┐                       ┌─────────────────────┐
        │  Swin Transformer   │                       │  50/50 Dual Ensemble│
        │      (Swin-T)       │                       │ EfficientNet-B0 +   │
        │  Grad-CAM: feat.7.1 │                       │ ResNet-50           │
        └──────────┬──────────┘                       └──────────┬──────────┘
                   │                                             │
                   ▼                                             ▼
       4-Class Softmax + CAM                        8-Disease Sigmoid + 3 CAMs
       • CNV     • DME                              (EffNet, ResNet, Combined)
       • DRUSEN  • NORMAL
```

---

## Key Capabilities & Features

### 1. Dual-Modality Retinal Analysis
- **Optical Coherence Tomography (OCT):** Detects structural neuroretinal disruptions, intraretinal fluid, and sub-RPE deposits.
- **Color Fundus Photography:** Evaluates surface vascular changes, optic disc cupping, and chorioretinal lesions.

### 2. Deep Learning Pipelines
- **OCT Pipeline (Swin-Tiny):**
  - Architecture: `torchvision.models.swin_t(weights=None)` with custom classification head `nn.Linear(768, 4)`.
  - Exact Aspect-Ratio Preprocessing: Grayscale conversion, Lanczos thumbnailing preserving aspect ratio to $(256, 256)$, 3-channel replication, ImageNet normalization, followed by zero-padding centering to $(3, 256, 256)$.
  - Output: Multi-class categorical Softmax distribution.
- **Fundus Pipeline (50/50 Ensemble):**
  - Architecture: Compound-scaled EfficientNet-B0 (`nn.Linear(1280, 8)`) and deep residual ResNet-50 (`nn.Linear(2048, 8)`).
  - Decision Logic: $0.5 \times \text{Sigmoid}(\text{EffNet}) + 0.5 \times \text{Sigmoid}(\text{ResNet})$ compared against individual disease decision thresholds optimized on validation data.
  - Output: Multi-label classification with scores, calibrated thresholds, and detection flags.

### 3. Real Grad-CAM Explainability (`inference/gradcam.py`)
- **OCT Swin-Tiny Grad-CAM (`SwinOCTGradCAM`):**
  - **Target Layer Selection:** Targets `model.features[-1][-1]` (`features.7.1`, the final `SwinTransformerBlock` before `model.norm`), whose channel-last activations `[B, 8, 8, 768]` are permuted to `[B, 768, 8, 8]`.
  - **Why not `model.norm`?** In `torchvision.models.swin_t`, `model.norm` is immediately followed by global average pooling and a linear head. Backpropagating from logits to `model.norm` yields spatially constant gradients ($\sigma_{\text{spatial}} = 0.0$), reducing Grad-CAM to plain CAM. Targeting `features.7.1` preserves genuine non-zero spatial gradient variation across the $8\times 8$ token grid.
  - **Padding Masking & Tissue Alignment:** The $8\times 8$ CAM is upsampled to $(256, 256)$, strictly zero-masked outside the active tissue bounding box $[y:y+h, x:x+w]$, min-max normalized inside the retinal tissue region, and aspect-ratio matched to the original image dimensions.
- **Fundus Multilabel Ensemble Grad-CAM (`FundusEnsembleGradCAM`):**
  - **Independent Backbone Attribution:** Computes disease-specific Grad-CAM independently for EfficientNet-B0 (`features.8`, $10\times 10 \times 1280$) and ResNet-50 (`layer4.2`, $10\times 10 \times 2048$) using each network's disease probability $\sigma(z_d)$ as the gradient target (falling back to raw logit only if $\sigma(z_d)(1-\sigma(z_d)) < 10^{-7}$).
  - **Weighted Ensemble Visualization:** Each individual CAM is upsampled to $(320, 320)$, masked to the active retinal crop (`ImageOps.pad` bounds), min-max normalized independently to $[0, 1]$, and blended using saved checkpoint weights ($0.5 \times \text{CAM}_{\text{eff}} + 0.5 \times \text{CAM}_{\text{res}}$) without double-weighting gradients.
  - **Limitations of Ensemble Grad-CAM:** The combined Fundus map is a weighted visualization of individual model explanations rather than a direct single-graph gradient of the entire probability-blended ensemble. Because final spatial maps are $8\times 8$ (OCT) and $10\times 10$ (Fundus), heatmaps indicate coarse spatial influence rather than pixel-accurate lesion segmentation.
- **Safety & Memory Lifecycle:** Forward hooks are registered per request inside a `try ... finally` block under a mutex lock (`threading.Lock()`) using `torch.autograd.grad`, ensuring hooks and intermediate graphs are released immediately while ordinary `predict_*` calls remain under `@torch.inference_mode()`.

### 4. Image Modality Validation Guardrail (`inference/modality_validator.py`)
- **Method:** Screens images *before* disease inference or Grad-CAM using an out-of-distribution (OOD) aware feature geometry over locally cached ImageNet-pretrained `efficientnet_b0` embeddings ($1280\text{-D} \rightarrow \text{PCA-}128$):
  1. Structural sanity check (minimum dimension $\ge 32\text{ px}$, grayscale pixel std $\ge 3.0$).
  2. L2-normalized cosine similarity to calibrated OCT and Fundus centroids.
  3. Regularized Ledoit-Wolf Mahalanobis distance in PCA-128 space.
  4. Calibrated 2-class OCT-vs-Fundus logistic discriminator with abstention margin.
- **Threshold Selection (`scripts/calibrate_modality_validator.py`):**
  - Fitted on disjoint training splits ($600$ OCT train + $600$ Fundus train) and tuned on validation splits ($400$ OCT + $300$ Fundus) against OOD negatives:
    - OCT acceptance: $d_{\text{oct}} \le 24.0$, $\cos_{\text{oct}} \ge 0.45$, $p_{\text{oct}} \ge 0.90$, $\cos_{\text{oct}} - \cos_{\text{fun}} \ge 0.15$.
    - Fundus acceptance: $d_{\text{fun}} \le 24.0$, $\cos_{\text{fun}} \ge 0.55$, $(1 - p_{\text{oct}}) \ge 0.90$, $\cos_{\text{fun}} - \cos_{\text{oct}} \ge 0.15$.
  - Any input outside these boundaries abstains safely as `unknown` and returns `HTTP 422` without calling the disease classifier.

### 5. Interactive Explainable AI Interface
- **Guardrail Feedback:** Displays clear modality rejection notices (`HTTP 422`) when wrong-modality, non-retinal, or ambiguous images are uploaded.
- **Explainable AI — Grad-CAM Workspace:**
  - Interactive class selector (`CNV`, `DME`, `DRUSEN`, `NORMAL`) for OCT and disease selector (`DR`, `MH`, `ODC`, `TSLN`, `DN`, `MYA`, `ARMD`, `BRVO` — including below-threshold conditions) for Fundus.
  - View mode switcher for Fundus: **Combined Ensemble (default)**, **EfficientNet-B0**, and **ResNet-50**.
  - 3-panel comparison: Original Retinal Image, Grad-CAM Map, and Interactive Overlay with a `0%–100%` opacity slider.
  - Client-side PNG export (`Download Overlay PNG`) enabled strictly when a genuine heatmap has been generated.

---

## Verified Model & Guardrail Evaluation

### 1. Disease Classification Metrics (Validation Splits)
- **OCT Swin-Tiny:** **95.02%** validation accuracy on Kermany OCT (Epoch 3, 4 classes); **95.70%** test accuracy ($n=1001$, `notebooks/Grad_Cam.ipynb`).
- **Fundus Dual Ensemble (50/50):** **0.5778** Macro F1, **0.8915** Mean AUROC, **0.5566** mAP across $640$ RFMiD validation images.

### 2. Modality Guardrail Evaluation (Held-Out Splits)
Evaluated strictly on completely held-out datasets (`OCT/test`, `RFMiD c. Testing Set`, external `skimage.data.retina`, and $33$ non-retinal/microscopy/grayscale/synthetic/ambiguous OOD images):

| Evaluation Metric | Result | Count / Sample Size |
|---|---:|---|
| **OCT Acceptance Rate** | **99.80%** | `999 / 1001` (`OCT/test`) |
| **OCT-to-Fundus Confusion** | **0.00%** | `0 / 1001` |
| **OCT Unknown / Abstention Rate** | **0.20%** | `2 / 1001` |
| **Fundus Acceptance Rate** | **99.84%** | `639 / 640` (`RFMiD c. Testing Set`) |
| **Fundus-to-OCT Confusion** | **0.00%** | `0 / 640` |
| **Fundus Unknown / Abstention Rate** | **0.16%** | `1 / 640` |
| **External Fundus (`skimage.data.retina`)** | **Accepted (`fundus`)** | `1 / 1` |
| **Non-Retinal / OOD Rejection Rate** | **100.00%** | `33 / 33` (natural photos, grayscale photos, microscopy `cell` / `immunohistochemistry`, synthetic noise, blurred/blended scans, 3D graphics) |

> [!NOTE]
> **Known Guardrail Limitations & Failure Cases:** Because no large multi-organ medical OOD benchmark (e.g., Chest X-ray, Brain MRI, Slit-lamp anterior segment datasets) was available locally for negative calibration, the guardrail is documented as a **provisional OOD screen**. Borderline or heavily degraded retinal scans ($0.20\%$ OCT, $0.16\%$ Fundus) may trigger conservative `unknown` abstention (`HTTP 422`), and unseen out-of-domain medical modalities outside the 33 local OOD test samples require additional external validation before clinical deployment.

---

## Target Diseases and Classifications

### OCT Tomography Classes (4 Categories)
| Class Code | Full Clinical Name | Pathological Hallmarks |
|---|---|---|
| **CNV** | Choroidal Neovascularization | Abnormal capillary growth through Bruch's membrane; subretinal/sub-RPE fluid (Wet AMD hallmark). |
| **DME** | Diabetic Macular Edema | Retinal thickening and intraretinal cystoid fluid spaces due to microvascular breakdown in diabetes. |
| **DRUSEN** | Retinal Drusen Deposits | Convex dome-shaped lipid-protein waste deposits beneath the RPE (precursor to Dry AMD). |
| **NORMAL** | Normal Retinal Morphology | Intact 10-layer retinal stratification, well-preserved foveal pit, continuous RPE and ellipsoid zone. |

### Fundus Photography Pathologies (8 RFMiD Categories)
| Code | Condition Name | Diagnostic Markers | Calibrated Cutoff |
|---|---|---|:---:|
| **DR** | Diabetic Retinopathy | Microaneurysms, flame hemorrhages, hard exudates, cotton-wool spots | `0.7640` |
| **MH** | Media Haze | Diffuse obscuration of fundus details due to cataracts, vitritis, or corneal scars | `0.5925` |
| **ODC** | Optic Disc Cupping | Enlarged cup-to-disc ratio (CDR > 0.5) indicating glaucomatous nerve remodeling | `0.5655` |
| **TSLN** | Tessellated Fundus | Prominent visualization of large choroidal vessels through thinned RPE | `0.5318` |
| **DN** | Drusen | Discrete yellowish-white extracellular nodular deposits in posterior pole | `0.6043` |
| **MYA** | Pathological Myopia | Chorioretinal atrophy, tilted disc, posterior staphyloma from axial elongation | `0.8476` |
| **ARMD**| Age-Related Macular Degeneration | Confluent macular drusen, geographic RPE atrophy, visual distortion | `0.6837` |
| **BRVO**| Branch Retinal Vein Occlusion | Wedge-shaped sector hemorrhages and edema along an occluded venous branch | `0.7858` |

---

## Repository Structure

```text
NetraDrishti/
├── backend/
│   ├── __init__.py
│   ├── main.py                     # FastAPI endpoints, 422 guardrails & thread locking
│   └── schemas.py                  # Pydantic schemas (Prediction + Explanation)
├── frontend/
│   ├── public/samples/             # Demo OCT and Fundus samples
│   └── src/
│       ├── components/workspace/
│       │   ├── GradCamSection.tsx  # Interactive Grad-CAM viewer, opacity slider & PNG export
│       │   ├── OCTResultView.tsx
│       │   ├── FundusResultView.tsx
│       │   ├── ImageUploader.tsx
│       │   └── ModalitySelector.tsx
│       ├── services/api.ts         # Typed API client (/predict/*, /explain/*, /health)
│       └── types/api.ts
├── inference/
│   ├── gradcam.py                  # SwinOCTGradCAM & FundusEnsembleGradCAM
│   ├── modality_validator.py       # ImageNet EffNet-B0 PCA-128 OOD modality guardrail
│   └── predictor.py                # Unified predictor & explainability orchestration
├── models/
│   ├── README.md                   # Checkpoint & calibration setup guide
│   └── modality_validator_stats.npz
├── notebooks/                      # Research & training notebooks (EDA, Grad_Cam, Fundus)
├── scripts/
│   └── calibrate_modality_validator.py  # Reproducible guardrail calibration & held-out eval
├── tests/
│   └── test_phase3.py              # Automated Grad-CAM, guardrail, endpoint & concurrency suite
└── requirements.txt
```

---

## API Specification

### `GET /api/health`
Returns readiness for both disease models and the modality guardrail (`models_ready`, `validator_ready`, `device`).

### `POST /api/predict/oct` and `POST /api/predict/fundus`
Enforce upload limits (10 MB, JPEG/PNG), Pillow safe decoding, and modality validation (`HTTP 422` if wrong-modality or `unknown`) prior to running disease classification.

### `POST /api/explain/oct?target_class=<CNV|DME|DRUSEN|NORMAL>`
Validates retinal OCT modality (`HTTP 422` on mismatch), computes Swin-Tiny Grad-CAM for `target_class` (defaulting to the top predicted class), and returns `predicted_class`, `selected_class`, `scores`, tissue-aligned `heatmap` & `overlay` PNG data URLs, `explanation_meta`, and `disclaimer`.

### `POST /api/explain/fundus?disease=<DR|MH|ODC|TSLN|DN|MYA|ARMD|BRVO>`
Validates retinal Fundus modality (`HTTP 422` on mismatch), computes disease-specific Grad-CAM maps for both EfficientNet-B0 and ResNet-50, blends normalized maps by ensemble weights, and returns `efficientnet_heatmap`, `resnet_heatmap`, `combined_heatmap`, `combined_overlay`, `predictions`, `model_weights`, `explanation_meta`, and `disclaimer`.

---

## Installation, Testing & Local Execution (Windows PowerShell)

### 1. Backend & Frontend Startup
```powershell
# Terminal 1 — Start FastAPI backend
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload

# Terminal 2 — Start React frontend
cd frontend
npm install
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** (Swagger UI at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**).

### 2. Running Verification Tests
```powershell
# Run Phase 3 Grad-CAM, modality guardrail, API contract & concurrency tests
python -u tests/test_phase3.py

# Re-run modality guardrail calibration & full 1,641 held-out test split evaluation
python -u scripts/calibrate_modality_validator.py

# Frontend TypeScript check, lint & production bundle
cd frontend
npm run lint
npm run build
```

---

## Dataset Attributions

1. **Retinal OCT Dataset:** *Kermany, D. S., Goldbaum, M., Cai, W., et al.* (2018). "Identifying Medical Diagnoses and Treatable Diseases by Image-Based Deep Learning." *Cell*, 172(5), 1122-1131.
2. **Retinal Fundus Multi-Disease Image Dataset (RFMiD):** *Pachade, S., Porwal, P., Thulkar, D., et al.* (2021). "Retinal Fundus Multi-Disease Image Dataset (RFMiD): A Dataset for Multi-Disease Detection." *Data*, 6(2), 14.

## License

This project is licensed under the [MIT License](LICENSE) with an express medical and educational use limitation.
