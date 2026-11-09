# NetraDrishti — AI-Powered Retinal Disease Analysis

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/ML-PyTorch%202.x-EE4C2C?style=flat-square&logo=pytorch)](https://pytorch.org/)
[![React](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Vite-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TailwindCSS](https://img.shields.io/badge/Styles-Tailwind%20CSS-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**NetraDrishti** is an advanced, dual-modality ophthalmic screening platform designed to assist in retinal disease triage. By integrating hierarchical **Vision Transformers (Swin-Tiny)** for cross-sectional Optical Coherence Tomography (OCT) scans and a **dual-backbone CNN ensemble (EfficientNet-B0 + ResNet-50)** for digital color Fundus photography, NetraDrishti provides rapid, automated detection across major blinding retinal pathologies.

> [!IMPORTANT]
> **Medical & Research Disclaimer:** NetraDrishti is developed strictly for research, educational, and scientific evaluation purposes. It is **not** certified as a clinical medical device under FDA or CE regulations. Predictions, probability distributions, and detection flags are algorithmic estimates and must never substitute for professional clinical evaluation by a licensed ophthalmologist or optometrist.

---

## Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │    Client / React 19 + TypeScript      │
                      │  (Modality Selector, Preview, Charts)  │
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
                   ┌──────────────────────┴──────────────────────┐
                   │                                             │
                   ▼ (OCT Mode)                                  ▼ (Fundus Mode)
        ┌─────────────────────┐                       ┌─────────────────────┐
        │  Swin Transformer   │                       │  50/50 Dual Ensemble│
        │      (Swin-T)       │                       │ EfficientNet-B0 +   │
        │                     │                       │ ResNet-50           │
        └──────────┬──────────┘                       └──────────┬──────────┘
                   │                                             │
                   ▼                                             ▼
       4-Class Softmax Output                        8-Disease Sigmoid Scores
       • CNV     • DME                               • DR   • MH   • ODC • TSLN
       • DRUSEN  • NORMAL                            • DN   • MYA  • ARMD • BRVO
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

### 3. Production-Oriented Backend
- **FastAPI Core:** Automatic Swagger documentation at `/docs` and ReDoc at `/redoc`.
- **Model Lifecycle:** Checkpoints loaded once during application startup via lifespan context manager; models remain resident in memory without reload per request.
- **Asynchronous & Thread-Safe:** ML inference runs in dedicated worker threads via `asyncio.to_thread` with a mutex lock around model forward passes to safeguard CPU/XPU acceleration.
- **Zero-Persistence Privacy:** Retinal images are processed entirely in-memory using volatile `io.BytesIO` streams; no user images are stored to disk.
- **Security Protections:** 10 MB chunked stream limit prevents memory overflow; Pillow decompression bomb protection capped at 25 million pixels.

### 4. Interactive Healthcare Frontend
- **Design System:** Ophthalmology-themed dark navy palette (`#050811`, `#080d1a`, `#0d1527`) with cyan and teal accents.
- **Real-Time Health Status:** Header badge continuously polls `/api/health` to reflect backend readiness.
- **File Management:** Drag-and-drop zone with image dimensions detection and bundled demo presets (`sample_oct_cnv.jpeg`, `sample_fundus_dr.png`).
- **Interactive Visualizations:** Recharts horizontal bar charts for OCT probability distributions and Fundus score-versus-threshold comparisons.
- **Clinical Biomarker Context:** Explanatory clinical cards detailing pathology hallmarks and clinical significance.

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

## Verified Model Evaluation Metrics

All metrics reflect verified evaluation executed on validation splits:

### 1. OCT Swin-Tiny Model
- **Benchmark Dataset:** Kermany et al. Retinal OCT Dataset (Cell 2018)
- **Validation Accuracy:** **95.02%** (`0.9502` at Epoch 3)
- **Embedding Dimension:** 768
- **Classification Paradigm:** 4-class multi-class Softmax

### 2. Fundus Dual Ensemble Model
- **Benchmark Dataset:** RFMiD (Retinal Fundus Multi-Disease Image Dataset)
- **Validation Split Size:** 640 images across 8 disease targets
- **Ensemble Policy:** 50% EfficientNet-B0 + 50% ResNet-50
- **Validation Macro F1:** **0.5778** (vs. 0.5709 for standalone EffNet, 0.5632 for standalone ResNet)
- **Mean AUROC:** **0.8915** (vs. 0.8863 for EffNet, 0.8780 for ResNet)
- **Mean Average Precision (mAP):** **0.5566**

---

## Repository Structure

```text
NetraDrishti/
├── backend/
│   ├── __init__.py           # Backend package configuration
│   ├── main.py               # FastAPI application, lifespan & endpoints
│   └── schemas.py            # Pydantic v2 response schemas
├── frontend/
│   ├── public/
│   │   └── samples/          # Bundled demo retinal images
│   ├── src/
│   │   ├── components/       # Layout, landing & workspace components
│   │   ├── constants/        # Clinical descriptions & knowledge base
│   │   ├── services/         # API fetch client & AbortController logic
│   │   ├── types/            # TypeScript data contracts
│   │   ├── App.tsx           # Main application state coordinator
│   │   └── main.tsx
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── Fundus/                   # RFMiD dataset label mapping CSVs
│   ├── a. RFMiD_Training_Labels.csv
│   ├── b. RFMiD_Validation_Labels.csv
│   └── c. RFMiD_Testing_Labels.csv
├── inference/
│   └── predictor.py          # Standalone unified predictor class
├── models/
│   ├── README.md             # Model checkpoint acquisition instructions
│   ├── train_manifest.csv    # Training manifest
│   └── val_manifest.csv      # Validation manifest
├── notebooks/                # Research & training notebooks
│   ├── EDA.ipynb             # Exploratory data analysis
│   ├── Grad_Cam.ipynb        # Swin Transformer Grad-CAM interpretability
│   └── Untitled.ipynb        # Fundus ensemble training & threshold calibration
├── .env.example              # Environment variables template
├── .gitignore                # Comprehensive ignore rules
├── LICENSE                   # MIT License with medical disclaimer
├── README.md                 # Project documentation
└── requirements.txt          # Python dependencies
```

---

## Installation and Local Setup

### Prerequisites
- **Python:** 3.10 or newer (tested on Python 3.11/3.12)
- **Node.js:** v18.0 or newer (tested on Node v22.20)
- **npm:** 9.0 or newer
- **Operating System:** Windows, Linux, or macOS

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/SohamG2696/NetraDrishti.git
cd NetraDrishti
```

---

### Step 2: Configure Model Weights
Model checkpoints (`*.pth`) are excluded from Git due to size restrictions. Ensure the following files are placed in the `models/` directory:
- `models/swin_tiny_epoch3.pth`
- `models/netradrishti_fundus_ensemble.pth`

*(Refer to [models/README.md](models/README.md) for full checkpoint details).*

---

### Step 3: Backend Setup (FastAPI)
Using Windows PowerShell:

```powershell
# Optional: create and activate virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install required dependencies
pip install -r requirements.txt

# Start FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

The API documentation will be available at:
- **Interactive Swagger UI:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **ReDoc Documentation:** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Endpoint:** [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

---

### Step 4: Frontend Setup (React + Vite)
In a second PowerShell terminal:

```powershell
cd frontend

# Install frontend dependencies
npm install

# Start Vite development server
npm run dev
```

Open your browser at: **[http://localhost:5173](http://localhost:5173)**.

---

## API Specification

### `GET /api/health`
Returns system status, active compute accelerator, and model readiness.
```json
{
  "status": "healthy",
  "models_ready": true,
  "device": "cpu",
  "supported_modalities": ["OCT", "Fundus"]
}
```

### `POST /api/predict/oct`
Accepts a retinal OCT scan via `multipart/form-data` (`file`).
```json
{
  "modality": "OCT",
  "predicted_class": "CNV",
  "confidence": 0.9914,
  "scores": {
    "CNV": 0.9914,
    "DME": 0.0061,
    "DRUSEN": 0.0017,
    "NORMAL": 0.0008
  },
  "disclaimer": "NetraDrishti is designed for research and educational purposes only..."
}
```

### `POST /api/predict/fundus`
Accepts a color retinal Fundus photograph via `multipart/form-data` (`file`).
```json
{
  "modality": "Fundus",
  "predictions": {
    "DR": { "score": 0.9525, "threshold": 0.7640, "detected": true },
    "MH": { "score": 0.0725, "threshold": 0.5925, "detected": false },
    "ODC": { "score": 0.0467, "threshold": 0.5655, "detected": false },
    "TSLN": { "score": 0.0951, "threshold": 0.5318, "detected": false },
    "DN": { "score": 0.1676, "threshold": 0.6043, "detected": false },
    "MYA": { "score": 0.0307, "threshold": 0.8476, "detected": false },
    "ARMD": { "score": 0.2554, "threshold": 0.6837, "detected": false },
    "BRVO": { "score": 0.8146, "threshold": 0.7858, "detected": true }
  },
  "disclaimer": "NetraDrishti is designed for research and educational purposes only..."
}
```

---

## Dataset Attributions

1. **Retinal OCT Dataset:**
   - *Kermany, D. S., Goldbaum, M., Cai, W., et al.* (2018). "Identifying Medical Diagnoses and Treatable Diseases by Image-Based Deep Learning." *Cell*, 172(5), 1122-1131.
2. **Retinal Fundus Multi-Disease Image Dataset (RFMiD):**
   - *Pachade, S., Porwal, P., Thulkar, D., et al.* (2021). "Retinal Fundus Multi-Disease Image Dataset (RFMiD): A Dataset for Multi-Disease Detection." *Data*, 6(2), 14.

---

## Known Limitations & Roadmap

- **Model Interpretability:** Grad-CAM saliency mapping for Swin Transformers is validated in research notebooks (`notebooks/Grad_Cam.ipynb`) and planned for API exposure in future iterations.
- **Single-Slice OCT Scope:** The current pipeline evaluates representative 2D B-scans rather than complete 3D volumetric OCT cubes.
- **External Calibration:** While thresholds were optimized on RFMiD validation splits, multi-center prospective validation across diverse imaging hardware remains future work.

---

## License

This project is licensed under the [MIT License](LICENSE) with an express medical and educational use limitation.

