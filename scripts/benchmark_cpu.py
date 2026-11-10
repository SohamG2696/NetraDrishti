"""
CPU Performance & Memory Benchmark Suite for NetraDrishti.

Measures realistic CPU latency, startup duration, and RSS memory consumption
for model loading, modality validation, OCT/Fundus predictions, Grad-CAM
explanations, and end-to-end FastAPI endpoints.
"""

import gc
import os
import statistics
import sys
import time
from pathlib import Path

os.environ["NETRADRISHTI_DEVICE"] = "cpu"

import psutil
import torch
from torch import nn
from torchvision.models import efficientnet_b0, resnet50, swin_t
from PIL import Image
from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def rss_mb(proc: psutil.Process) -> float:
    return proc.memory_info().rss / (1024 * 1024)


def stats_summary(values: list[float]) -> dict[str, float]:
    return {
        "min_ms": round(min(values) * 1000.0, 1),
        "median_ms": round(statistics.median(values) * 1000.0, 1),
        "mean_ms": round(statistics.mean(values) * 1000.0, 1),
        "max_ms": round(max(values) * 1000.0, 1),
    }


def benchmark_individual_loading() -> None:
    proc = psutil.Process()
    print("=== 1. COMPONENT MODEL LOADING & MEMORY BENCHMARK (CPU) ===")
    base_rss = rss_mb(proc)
    print(f"Baseline Python + PyTorch RSS: {base_rss:.1f} MB")

    # 1. EfficientNet-B0 (Fundus)
    t0 = time.perf_counter()
    f_ckpt = torch.load(PROJECT_ROOT / "models/netradrishti_fundus_ensemble.pth", map_location="cpu", weights_only=True)
    eff = efficientnet_b0(weights=None)
    eff.classifier[1] = nn.Linear(1280, len(f_ckpt["diseases"]))
    eff.load_state_dict(f_ckpt["efficientnet_state"])
    eff.eval()
    t_eff = time.perf_counter() - t0
    rss_after_eff = rss_mb(proc)
    print(f"EfficientNet-B0 load time: {t_eff:.3f}s | RSS: {rss_after_eff:.1f} MB (+{rss_after_eff - base_rss:.1f} MB)")

    # 2. ResNet-50 (Fundus)
    t0 = time.perf_counter()
    res = resnet50(weights=None)
    res.fc = nn.Linear(2048, len(f_ckpt["diseases"]))
    res.load_state_dict(f_ckpt["resnet_state"])
    res.eval()
    t_res = time.perf_counter() - t0
    rss_after_res = rss_mb(proc)
    print(f"ResNet-50 load time:       {t_res:.3f}s | RSS: {rss_after_res:.1f} MB (+{rss_after_res - rss_after_eff:.1f} MB)")
    del f_ckpt, eff, res
    gc.collect()

    # 3. Swin-Tiny (OCT)
    rss_before_swin = rss_mb(proc)
    t0 = time.perf_counter()
    o_ckpt = torch.load(PROJECT_ROOT / "models/swin_tiny_epoch3.pth", map_location="cpu", weights_only=True)
    swin = swin_t(weights=None)
    swin.head = nn.Linear(768, len(o_ckpt["class_to_idx"]))
    swin.load_state_dict(o_ckpt["model_state_dict"])
    swin.eval()
    t_swin = time.perf_counter() - t0
    rss_after_swin = rss_mb(proc)
    print(f"Swin-Tiny load time:       {t_swin:.3f}s | RSS: {rss_after_swin:.1f} MB (+{rss_after_swin - rss_before_swin:.1f} MB)")
    del o_ckpt, swin
    gc.collect()

    # 4. ModalityValidator
    from inference.modality_validator import ModalityValidator
    rss_before_val = rss_mb(proc)
    t0 = time.perf_counter()
    mv = ModalityValidator(device=torch.device("cpu"))
    assert mv.ready
    t_mv = time.perf_counter() - t0
    rss_after_mv = rss_mb(proc)
    print(f"ModalityValidator load:    {t_mv:.3f}s | RSS: {rss_after_mv:.1f} MB (+{rss_after_mv - rss_before_val:.1f} MB)")
    del mv
    gc.collect()


def benchmark_end_to_end() -> None:
    from backend.main import app

    proc = psutil.Process()
    oct_path = PROJECT_ROOT / "OCT/test/CNV/CNV-1032178-1.jpeg"
    fun_path = PROJECT_ROOT / "RFMiD/1. Original Images/1. Original Images/a. Training Set/1.png"
    oct_bytes = oct_path.read_bytes()
    fun_bytes = fun_path.read_bytes()
    oct_img = Image.open(oct_path)
    fun_img = Image.open(fun_path)

    print("\n=== 2. FULL APPLICATION STARTUP & STEADY-STATE MEMORY ===")
    rss_pre = rss_mb(proc)
    t_start = time.perf_counter()
    with TestClient(app) as client:
        startup_sec = time.perf_counter() - t_start
        steady_rss = rss_mb(proc)
        print(f"Total FastAPI + Models + Validator startup time: {startup_sec:.3f}s")
        print(f"Pre-startup RSS: {rss_pre:.1f} MB | Steady-state RSS: {steady_rss:.1f} MB")

        # Direct validator timing (5 runs after 1 warmup)
        mv = app.state.modality_validator
        _ = mv.validate(oct_img)
        val_oct_times, val_fun_times = [], []
        for _ in range(5):
            t0 = time.perf_counter(); mv.validate(oct_img); val_oct_times.append(time.perf_counter() - t0)
            t0 = time.perf_counter(); mv.validate(fun_img); val_fun_times.append(time.perf_counter() - t0)

        print("\n=== 3. DIRECT ML LATENCY & PEAK MEMORY (5 RUNS EACH, WARMED UP) ===")
        print("Modality validate (OCT):   ", stats_summary(val_oct_times))
        print("Modality validate (Fundus):", stats_summary(val_fun_times))

        pred = app.state.predictor
        _ = pred.predict_oct(oct_img)
        _ = pred.predict_fundus(fun_img)

        def run_op(label: str, fn):
            times = []
            peak = rss_mb(proc)
            for _ in range(5):
                t0 = time.perf_counter()
                fn()
                times.append(time.perf_counter() - t0)
                peak = max(peak, rss_mb(proc))
            print(f"{label:28s} {stats_summary(times)} | Peak RSS: {peak:.1f} MB")

        run_op("OCT predict_oct:", lambda: pred.predict_oct(oct_img))
        run_op("Fundus predict_fundus:", lambda: pred.predict_fundus(fun_img))
        run_op("OCT Swin Grad-CAM:", lambda: pred.explain_oct(oct_img, "CNV"))
        run_op("Fundus Ensemble Grad-CAM:", lambda: pred.explain_fundus(fun_img, "DR"))

        print("\n=== 4. END-TO-END HTTP API LATENCY (THROUGH GUARDRAILS, 5 RUNS) ===")
        # Warmup HTTP calls
        client.get("/api/live")
        client.get("/api/health")
        client.post("/api/predict/oct", files={"file": ("oct.jpeg", oct_bytes, "image/jpeg")})

        def run_http(label: str, method: str, url: str, files=None):
            times = []
            peak = rss_mb(proc)
            for _ in range(5):
                t0 = time.perf_counter()
                r = client.get(url) if method == "GET" else client.post(url, files=files)
                assert r.status_code == 200, f"{url} returned {r.status_code}: {r.text}"
                times.append(time.perf_counter() - t0)
                peak = max(peak, rss_mb(proc))
            print(f"{label:32s} {stats_summary(times)} | Peak RSS: {peak:.1f} MB")

        run_http("GET /api/live:", "GET", "/api/live")
        run_http("GET /api/health:", "GET", "/api/health")
        run_http("POST /api/predict/oct:", "POST", "/api/predict/oct", {"file": ("oct.jpeg", oct_bytes, "image/jpeg")})
        run_http("POST /api/predict/fundus:", "POST", "/api/predict/fundus", {"file": ("fun.png", fun_bytes, "image/png")})
        run_http("POST /api/explain/oct:", "POST", "/api/explain/oct?target_class=CNV", {"file": ("oct.jpeg", oct_bytes, "image/jpeg")})
        run_http("POST /api/explain/fundus:", "POST", "/api/explain/fundus?disease=DR", {"file": ("fun.png", fun_bytes, "image/png")})

        final_rss = rss_mb(proc)
        print(f"\nPost-benchmark steady-state RSS: {final_rss:.1f} MB")


if __name__ == "__main__":
    benchmark_individual_loading()
    benchmark_end_to_end()

