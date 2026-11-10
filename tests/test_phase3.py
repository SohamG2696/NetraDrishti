"""
Phase 3 Verification Suite for NetraDrishti:
  - Real Swin-Tiny OCT Grad-CAM (alignment, padding masking, class specificity, finite spatial gradients)
  - Real EfficientNet-B0 + ResNet-50 Fundus Grad-CAM (multilabel target switching, ensemble blending)
  - Modality guardrail enforcement (422 rejections for cross-modality, non-retinal, microscopy, blank)
  - FastAPI endpoint contracts (/api/health, /api/predict/*, /api/explain/*) & concurrency safety
"""

import base64
import concurrent.futures
import io
import sys
from pathlib import Path

import numpy as np
import skimage.data as skd
from fastapi.testclient import TestClient
from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app
from inference.predictor import NetraDrishtiPredictor


def _decode_data_url(data_url: str) -> Image.Image:
    assert data_url.startswith("data:image/png;base64,")
    raw = base64.b64decode(data_url.split(",", 1)[1])
    return Image.open(io.BytesIO(raw))


def _pil_to_bytes(img: Image.Image, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return buf.getvalue()


def test_gradcam_core():
    print("\n=== 1. TESTING CORE GRAD-CAM (OCT + FUNDUS) ===")
    predictor = NetraDrishtiPredictor()

    oct_samples = {
        "CNV": PROJECT_ROOT / "OCT/test/CNV/CNV-1032178-1.jpeg",
        "DME": PROJECT_ROOT / "OCT/test/DME/DME-1029576-1.jpeg",
        "DRUSEN": PROJECT_ROOT / "OCT/test/DRUSEN/DRUSEN-1021298-1.jpeg",
        "NORMAL": PROJECT_ROOT / "OCT/test/NORMAL/NORMAL-100980-1.jpeg",
    }

    for gt, path in oct_samples.items():
        img = Image.open(path)
        pred_before = predictor.predict_oct(img)
        exp = predictor.explain_oct(img, target_class=gt)
        pred_after = predictor.predict_oct(img)

        assert pred_before == pred_after, "Prediction mutated after Grad-CAM!"
        meta = exp["explanation_meta"]
        assert meta["finite_gradients"] is True
        assert meta["grad_abs_mean"] > 0.0
        assert meta["grad_spatial_std"] > 0.0, "Spatial gradients vanished!"
        assert meta["pad_max_after_masking"] == 0.0
        assert meta["active_std"] > 0.05, "Heatmap is nearly uniform!"

        heat_im = _decode_data_url(exp["heatmap"])
        orig_ratio = img.size[0] / img.size[1]
        heat_ratio = heat_im.size[0] / heat_im.size[1]
        assert abs(orig_ratio - heat_ratio) < 0.03, f"Aspect mismatch: {orig_ratio} vs {heat_ratio}"
        print(
            f"  OCT {gt:6s} | pred={exp['predicted_class']} ({exp['confidence']:.4f}) "
            f"| heat_size={heat_im.size} | grad_spatial_std={meta['grad_spatial_std']:.2e} | pad_max={meta['pad_max_after_masking']}"
        )

    # Class-specificity check on single CNV scan
    cnv_img = Image.open(oct_samples["CNV"])
    exp_cnv = np.asarray(_decode_data_url(predictor.explain_oct(cnv_img, "CNV")["heatmap"]), dtype=np.float32)
    exp_norm = np.asarray(_decode_data_url(predictor.explain_oct(cnv_img, "NORMAL")["heatmap"]), dtype=np.float32)
    diff_oct_cls = float(np.abs(exp_cnv - exp_norm).mean())
    assert diff_oct_cls > 10.0, f"OCT class heatmaps too similar: {diff_oct_cls}"
    print(f"  OCT class-specificity (CNV vs NORMAL pixel diff): {diff_oct_cls:.2f}")

    # Fundus Multilabel Grad-CAM check
    fundus_path = PROJECT_ROOT / "RFMiD/1. Original Images/1. Original Images/a. Training Set/1.png"
    fundus_img = Image.open(fundus_path)
    f_before = predictor.predict_fundus(fundus_img)
    exp_dr = predictor.explain_fundus(fundus_img, target_disease="DR")
    exp_odc = predictor.explain_fundus(fundus_img, target_disease="ODC")  # below threshold!
    f_after = predictor.predict_fundus(fundus_img)

    assert f_before == f_after, "Fundus prediction changed after Grad-CAM!"
    assert exp_dr["selected_detected"] is True
    assert exp_odc["selected_detected"] is False  # below threshold still explainable

    h_dr = np.asarray(_decode_data_url(exp_dr["combined_heatmap"]), dtype=np.float32)
    h_odc = np.asarray(_decode_data_url(exp_odc["combined_heatmap"]), dtype=np.float32)
    h_eff = np.asarray(_decode_data_url(exp_dr["efficientnet_heatmap"]), dtype=np.float32)
    h_res = np.asarray(_decode_data_url(exp_dr["resnet_heatmap"]), dtype=np.float32)

    assert float(np.abs(h_dr - h_odc).mean()) > 5.0, "Disease-specific Fundus heatmaps did not change!"
    assert float(np.abs(h_eff - h_res).mean()) > 5.0, "EffNet and ResNet heatmaps look identical!"
    assert exp_dr["explanation_meta"]["efficientnet_stats"]["finite_gradients"] is True
    assert exp_dr["explanation_meta"]["resnet_stats"]["finite_gradients"] is True
    print(
        f"  Fundus DR (detected={exp_dr['selected_detected']}, score={exp_dr['selected_score']}) vs "
        f"ODC (detected={exp_odc['selected_detected']}, score={exp_odc['selected_score']}) diff: "
        f"{np.abs(h_dr - h_odc).mean():.2f}"
    )


def test_api_guardrails_and_endpoints():
    print("\n=== 2. TESTING FASTAPI GUARDRAILS & ENDPOINTS ===")
    oct_bytes = (PROJECT_ROOT / "OCT/test/CNV/CNV-1032178-1.jpeg").read_bytes()
    fundus_bytes = (PROJECT_ROOT / "RFMiD/1. Original Images/1. Original Images/a. Training Set/1.png").read_bytes()
    astro_bytes = _pil_to_bytes(Image.fromarray(skd.astronaut()), "JPEG")
    cell_bytes = _pil_to_bytes(Image.fromarray(skd.cell()), "PNG")
    blank_bytes = _pil_to_bytes(Image.new("RGB", (256, 256), (0, 0, 0)), "PNG")

    with TestClient(app) as client:
        # Health
        r_health = client.get("/api/health")
        assert r_health.status_code == 200
        h = r_health.json()
        assert h["models_ready"] is True and h["validator_ready"] is True
        print("  /api/health:", h)

        # Valid predictions
        r_oct = client.post("/api/predict/oct", files={"file": ("oct.jpeg", oct_bytes, "image/jpeg")})
        assert r_oct.status_code == 200 and r_oct.json()["predicted_class"] == "CNV"
        r_fun = client.post("/api/predict/fundus", files={"file": ("fun.png", fundus_bytes, "image/png")})
        assert r_fun.status_code == 200 and r_fun.json()["predictions"]["DR"]["detected"] is True
        print("  Valid OCT & Fundus predictions: 200 OK")

        # Cross-modality rejections (422)
        r_f_on_o = client.post("/api/predict/oct", files={"file": ("fun.png", fundus_bytes, "image/png")})
        assert r_f_on_o.status_code == 422
        assert "valid retinal OCT scan" in r_f_on_o.json()["detail"]

        r_o_on_f = client.post("/api/predict/fundus", files={"file": ("oct.jpeg", oct_bytes, "image/jpeg")})
        assert r_o_on_f.status_code == 422
        assert "valid retinal Fundus photograph" in r_o_on_f.json()["detail"]

        # Non-retinal, unrelated medical, and blank rejections (422)
        for label, b, ctype in [
            ("astronaut", astro_bytes, "image/jpeg"),
            ("cell_microscopy", cell_bytes, "image/png"),
            ("blank_black", blank_bytes, "image/png"),
        ]:
            ro = client.post("/api/predict/oct", files={"file": (f"{label}.png", b, ctype)})
            rf = client.post("/api/predict/fundus", files={"file": (f"{label}.png", b, ctype)})
            assert ro.status_code == 422, f"{label} unexpectedly passed OCT: {ro.status_code}"
            assert rf.status_code == 422, f"{label} unexpectedly passed Fundus: {rf.status_code}"
        print("  Cross-modality, non-retinal, microscopy, and blank rejections: all 422 OK")

        # Explainability endpoints & guardrails
        e_oct = client.post("/api/explain/oct?target_class=NORMAL", files={"file": ("oct.jpeg", oct_bytes, "image/jpeg")})
        assert e_oct.status_code == 200
        ej = e_oct.json()
        assert ej["selected_class"] == "NORMAL"
        assert ej["heatmap"].startswith("data:image/png;base64,")
        assert ej["overlay"].startswith("data:image/png;base64,")

        e_fun = client.post("/api/explain/fundus?disease=BRVO", files={"file": ("fun.png", fundus_bytes, "image/png")})
        assert e_fun.status_code == 200
        fj = e_fun.json()
        assert fj["selected_disease"] == "BRVO"
        assert fj["combined_heatmap"].startswith("data:image/png;base64,")
        assert fj["efficientnet_heatmap"].startswith("data:image/png;base64,")
        assert fj["resnet_heatmap"].startswith("data:image/png;base64,")

        # Invalid class/disease query parameter -> 400
        e_bad = client.post("/api/explain/oct?target_class=INVALID", files={"file": ("oct.jpeg", oct_bytes, "image/jpeg")})
        assert e_bad.status_code == 400

        # Guardrail blocks explain endpoint on wrong modality -> 422
        e_wrong = client.post("/api/explain/oct", files={"file": ("fun.png", fundus_bytes, "image/png")})
        assert e_wrong.status_code == 422
        print("  Explainability endpoints + 400/422 guardrails: passed")

        # Concurrency check: run explain + predict concurrently
        def call_predict():
            return client.post("/api/predict/oct", files={"file": ("oct.jpeg", oct_bytes, "image/jpeg")}).status_code

        def call_explain():
            return client.post("/api/explain/fundus?disease=DR", files={"file": ("fun.png", fundus_bytes, "image/png")}).status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            futs = [pool.submit(call_predict), pool.submit(call_explain), pool.submit(call_predict), pool.submit(call_explain)]
            statuses = [f.result() for f in futs]
        assert statuses == [200, 200, 200, 200], f"Concurrent status failure: {statuses}"
        print("  Concurrent prediction + Grad-CAM execution: [200, 200, 200, 200] OK")


if __name__ == "__main__":
    test_gradcam_core()
    test_api_guardrails_and_endpoints()
    print("\nALL PHASE 3 TESTS PASSED!")

