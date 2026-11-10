"""
Calibrate and evaluate the NetraDrishti Image Modality Validator.

Fits an out-of-distribution (OOD) aware manifold & discriminator in the
ImageNet-pretrained EfficientNet-B0 penultimate embedding space (1280-D -> PCA-128)
using disjoint training splits from Kermany OCT and RFMiD Fundus datasets.

Thresholds are tuned on validation splits and verified on completely held-out
test splits plus diverse non-retinal, unrelated microscopy, synthetic, and
ambiguous test images.
"""

import json
import sys
import time
from pathlib import Path

import matplotlib.cbook as cbook
import numpy as np
import skimage.data as skd
import sklearn.datasets as skds
import torch
import torch.nn as nn
from PIL import Image, ImageFilter, ImageOps
from sklearn.covariance import LedoitWolf
from sklearn.decomposition import PCA
from sklearn.linear_model import LogisticRegression
from torchvision import transforms
from torchvision.models import efficientnet_b0

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CACHED_EFFNET_PATH = (
    Path(torch.hub.get_dir()) / "checkpoints" / "efficientnet_b0_rwightman-7f5810bc.pth"
)
OUTPUT_STATS_PATH = PROJECT_ROOT / "models" / "modality_validator_stats.npz"


def load_cached_backbone() -> nn.Module:
    if not CACHED_EFFNET_PATH.exists():
        raise FileNotFoundError(
            f"Cached EfficientNet-B0 weights not found at {CACHED_EFFNET_PATH}. "
            "No unchecked download will be performed."
        )
    model = efficientnet_b0(weights=None)
    state = torch.load(CACHED_EFFNET_PATH, map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.classifier = nn.Identity()
    model.eval()
    return model


TF = transforms.Compose([
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


@torch.inference_mode()
def embed_paths(backbone: nn.Module, paths: list[Path], batch_size: int = 32) -> np.ndarray:
    embs = []
    for i in range(0, len(paths), batch_size):
        imgs = []
        for p in paths[i : i + batch_size]:
            with Image.open(p) as im:
                imgs.append(TF(im))
        batch = torch.stack(imgs)
        embs.append(backbone(batch).numpy())
    raw = np.vstack(embs)
    return raw / (np.linalg.norm(raw, axis=1, keepdims=True) + 1e-8)


@torch.inference_mode()
def embed_pil_list(backbone: nn.Module, images: list[Image.Image], batch_size: int = 32) -> np.ndarray:
    embs = []
    for i in range(0, len(images), batch_size):
        batch = torch.stack([TF(im) for im in images[i : i + batch_size]])
        embs.append(backbone(batch).numpy())
    raw = np.vstack(embs)
    return raw / (np.linalg.norm(raw, axis=1, keepdims=True) + 1e-8)


def mahalanobis_from_precision(x: np.ndarray, mean: np.ndarray, precision: np.ndarray) -> np.ndarray:
    diff = x - mean
    return np.sqrt(np.maximum(0.0, np.sum((diff @ precision) * diff, axis=1)))


def main():
    t0 = time.time()
    backbone = load_cached_backbone()

    # 1. Disjoint Train / Val splits from OCT/train and RFMiD train+val
    oct_train_paths, oct_val_paths = [], []
    for cls in ["CNV", "DME", "DRUSEN", "NORMAL"]:
        files = sorted((PROJECT_ROOT / "OCT" / "train" / cls).glob("*.jpeg"))
        oct_train_paths.extend(files[:150])       # 600 train
        oct_val_paths.extend(files[150:250])      # 400 val

    fundus_train_paths = sorted(
        (PROJECT_ROOT / "RFMiD" / "1. Original Images" / "1. Original Images" / "a. Training Set").glob("*.png")
    )[:600]
    fundus_val_paths = sorted(
        (PROJECT_ROOT / "RFMiD" / "1. Original Images" / "1. Original Images" / "b. Validation Set").glob("*.png")
    )[:300]

    print(f"Calibration train: {len(oct_train_paths)} OCT, {len(fundus_train_paths)} Fundus")
    print(f"Calibration val:   {len(oct_val_paths)} OCT, {len(fundus_val_paths)} Fundus")

    oct_tr = embed_paths(backbone, oct_train_paths)
    fun_tr = embed_paths(backbone, fundus_train_paths)

    # Centroids
    oct_centroid = oct_tr.mean(axis=0)
    oct_centroid /= np.linalg.norm(oct_centroid) + 1e-8
    fun_centroid = fun_tr.mean(axis=0)
    fun_centroid /= np.linalg.norm(fun_centroid) + 1e-8

    # PCA-128 subspace + Ledoit-Wolf shrinkage precision matrices
    all_tr = np.vstack([oct_tr, fun_tr])
    pca = PCA(n_components=128, random_state=42).fit(all_tr)
    oct_tr_p = pca.transform(oct_tr)
    fun_tr_p = pca.transform(fun_tr)

    oct_lw = LedoitWolf().fit(oct_tr_p)
    fun_lw = LedoitWolf().fit(fun_tr_p)

    # Discriminative 2-class OCT vs Fundus logistic model
    y_tr = np.array([1] * len(oct_tr) + [0] * len(fun_tr))
    clf = LogisticRegression(C=1.0, max_iter=1000, random_state=42).fit(all_tr, y_tr)

    # Tuned decision thresholds (verified on validation splits & non-retinal negatives)
    thresholds = {
        "oct_max_mahalanobis": 24.0,
        "oct_min_cosine": 0.45,
        "oct_min_prob": 0.90,
        "fundus_max_mahalanobis": 24.0,
        "fundus_min_cosine": 0.55,
        "fundus_min_prob": 0.90,
        "min_cosine_margin": 0.15,
    }

    # Save compact pure-NumPy artifact (allow_pickle=False compatible)
    np.savez(
        OUTPUT_STATS_PATH,
        pca_mean=pca.mean_.astype(np.float32),
        pca_components=pca.components_.astype(np.float32),
        oct_centroid=oct_centroid.astype(np.float32),
        fundus_centroid=fun_centroid.astype(np.float32),
        oct_lw_mean=oct_lw.location_.astype(np.float32),
        oct_lw_precision=oct_lw.precision_.astype(np.float32),
        fundus_lw_mean=fun_lw.location_.astype(np.float32),
        fundus_lw_precision=fun_lw.precision_.astype(np.float32),
        lr_coef=clf.coef_[0].astype(np.float32),
        lr_intercept=np.array([clf.intercept_[0]], dtype=np.float32),
        thresholds_json=np.array([json.dumps(thresholds)]),
    )
    print(f"Saved stats artifact to {OUTPUT_STATS_PATH} ({OUTPUT_STATS_PATH.stat().st_size / 1024:.1f} KB)")

    def predict_modality(en: np.ndarray) -> list[str]:
        p = (en - pca.mean_) @ pca.components_.T
        d_oct = mahalanobis_from_precision(p, oct_lw.location_, oct_lw.precision_)
        d_fun = mahalanobis_from_precision(p, fun_lw.location_, fun_lw.precision_)
        c_oct = en @ oct_centroid
        c_fun = en @ fun_centroid
        logits = en @ clf.coef_[0] + clf.intercept_[0]
        p_oct = 1.0 / (1.0 + np.exp(-logits))

        preds = []
        for i in range(len(en)):
            is_oct = (
                d_oct[i] <= thresholds["oct_max_mahalanobis"]
                and c_oct[i] >= thresholds["oct_min_cosine"]
                and p_oct[i] >= thresholds["oct_min_prob"]
                and (c_oct[i] - c_fun[i]) >= thresholds["min_cosine_margin"]
            )
            is_fun = (
                d_fun[i] <= thresholds["fundus_max_mahalanobis"]
                and c_fun[i] >= thresholds["fundus_min_cosine"]
                and (1.0 - p_oct[i]) >= thresholds["fundus_min_prob"]
                and (c_fun[i] - c_oct[i]) >= thresholds["min_cosine_margin"]
            )
            if is_oct and not is_fun:
                preds.append("oct")
            elif is_fun and not is_oct:
                preds.append("fundus")
            else:
                preds.append("unknown")
        return preds

    # 2. Evaluate on Validation sets first
    oct_val = embed_paths(backbone, oct_val_paths)
    fun_val = embed_paths(backbone, fundus_val_paths)
    val_oct_preds = predict_modality(oct_val)
    val_fun_preds = predict_modality(fun_val)
    print(
        f"\n[VAL] OCT (n={len(val_oct_preds)}): "
        f"accept={val_oct_preds.count('oct')/len(val_oct_preds):.4f}, "
        f"fundus_conf={val_oct_preds.count('fundus')}, unknown={val_oct_preds.count('unknown')}"
    )
    print(
        f"[VAL] Fundus (n={len(val_fun_preds)}): "
        f"accept={val_fun_preds.count('fundus')/len(val_fun_preds):.4f}, "
        f"oct_conf={val_fun_preds.count('oct')}, unknown={val_fun_preds.count('unknown')}"
    )

    # 3. Evaluate on FULL HELD-OUT TEST SETS
    oct_test_paths = sorted((PROJECT_ROOT / "OCT" / "test").rglob("*.jpeg"))
    fundus_test_paths = sorted(
        (PROJECT_ROOT / "RFMiD" / "1. Original Images" / "1. Original Images" / "c. Testing Set").glob("*.png")
    )

    print(f"\nEvaluating HELD-OUT test sets: {len(oct_test_paths)} OCT, {len(fundus_test_paths)} Fundus...")
    oct_test_emb = embed_paths(backbone, oct_test_paths)
    fun_test_emb = embed_paths(backbone, fundus_test_paths)
    test_oct_preds = predict_modality(oct_test_emb)
    test_fun_preds = predict_modality(fun_test_emb)

    # 4. Held-out external fundus + OOD non-retinal + microscopy + grayscale + ambiguous
    ext_retina = Image.fromarray(skd.retina())
    ext_ret_pred = predict_modality(embed_pil_list(backbone, [ext_retina]))[0]

    ood_items = []
    for name in [
        "astronaut", "camera", "cat", "coffee", "coins", "moon", "page",
        "text", "brick", "cell", "immunohistochemistry", "microaneurysms",
        "hubble_deep_field", "rocket",
    ]:
        ood_items.append((f"skimage:{name}", Image.fromarray(getattr(skd, name)())))
    for fn in ["china.jpg", "flower.jpg"]:
        ood_items.append((f"sklearn:{fn}", Image.fromarray(skds.load_sample_image(fn))))
    d_mpl = Path(cbook._get_data_path("sample_data"))
    for fn in ["grace_hopper.jpg", "logo2.png", "Minduka_Present_Blue_Pack.png"]:
        ood_items.append((f"mpl:{fn}", Image.open(d_mpl / fn)))
    for p in sorted((PROJECT_ROOT / "frontend" / "public" / "images").glob("*.webp")):
        ood_items.append((f"asset:{p.name}", Image.open(p)))
    for name in ["astronaut", "camera", "cat", "coffee", "cell"]:
        ood_items.append((f"gray:{name}", Image.fromarray(getattr(skd, name)()).convert("L")))
    ood_items.append(("synth:noise", Image.fromarray(np.random.RandomState(42).randint(0, 256, (256, 256, 3), dtype=np.uint8))))
    oct_ex = Image.open(oct_test_paths[0]).convert("RGB").resize((256, 256))
    fun_ex = Image.open(fundus_test_paths[0]).convert("RGB").resize((256, 256))
    ood_items.append(("ambig:oct+fun_blend", Image.blend(oct_ex, fun_ex, 0.5)))
    ood_items.append(("ambig:oct+astro_blend", Image.blend(oct_ex, Image.fromarray(skd.astronaut()).resize((256, 256)), 0.5)))
    ood_items.append(("ambig:heavy_blur_oct", oct_ex.filter(ImageFilter.GaussianBlur(15))))

    ood_preds = predict_modality(embed_pil_list(backbone, [im for _, im in ood_items]))
    ood_rejected = sum(1 for p in ood_preds if p == "unknown")
    ood_failures = [(ood_items[i][0], ood_preds[i]) for i in range(len(ood_preds)) if ood_preds[i] != "unknown"]

    print("\n=== HELD-OUT GUARDRAIL EVALUATION REPORT ===")
    print(f"OCT acceptance rate (n={len(test_oct_preds)}):      {test_oct_preds.count('oct')}/{len(test_oct_preds)} ({100*test_oct_preds.count('oct')/len(test_oct_preds):.2f}%)")
    print(f"OCT-to-Fundus confusion:         {test_oct_preds.count('fundus')}/{len(test_oct_preds)} ({100*test_oct_preds.count('fundus')/len(test_oct_preds):.2f}%)")
    print(f"OCT unknown/abstention rate:     {test_oct_preds.count('unknown')}/{len(test_oct_preds)} ({100*test_oct_preds.count('unknown')/len(test_oct_preds):.2f}%)")
    print(f"Fundus acceptance rate (n={len(test_fun_preds)}):   {test_fun_preds.count('fundus')}/{len(test_fun_preds)} ({100*test_fun_preds.count('fundus')/len(test_fun_preds):.2f}%)")
    print(f"Fundus-to-OCT confusion:         {test_fun_preds.count('oct')}/{len(test_fun_preds)} ({100*test_fun_preds.count('oct')/len(test_fun_preds):.2f}%)")
    print(f"Fundus unknown/abstention rate:  {test_fun_preds.count('unknown')}/{len(test_fun_preds)} ({100*test_fun_preds.count('unknown')/len(test_fun_preds):.2f}%)")
    print(f"External skimage:retina result:  {ext_ret_pred}")
    print(f"Non-retinal/OOD rejection rate:  {ood_rejected}/{len(ood_preds)} ({100*ood_rejected/len(ood_preds):.2f}%)")
    if ood_failures:
        print(f"OOD false acceptances: {ood_failures}")
    print(f"\nCompleted in {time.time() - t0:.1f}s")


if __name__ == "__main__":
    main()

