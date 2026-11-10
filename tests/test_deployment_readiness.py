"""
Deployment Readiness & Production Hardening Tests for NetraDrishti.

Covers:
  - /api/live (process liveness) vs /api/health (model + validator readiness)
  - Safe failure behavior when model files are missing (503 readiness, 200 liveness)
  - Configurable MODEL_DIR loading
  - Production CORS wildcard stripping
  - API documentation toggle (ENABLE_DOCS=false)
  - CPU device resolution without XPU requirements
"""

import importlib
import os
import sys
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def test_missing_models_readiness_separation():
    print("=== 1. TESTING MISSING MODEL FILES BEHAVIOR (LIVENESS vs READINESS) ===")
    with tempfile.TemporaryDirectory() as empty_dir:
        orig_model_dir = os.environ.get("MODEL_DIR")
        orig_backbone = os.environ.get("MODALITY_BACKBONE_PATH")
        try:
            os.environ["MODEL_DIR"] = empty_dir
            os.environ["MODALITY_BACKBONE_PATH"] = str(Path(empty_dir) / "missing.pth")

            import backend.main as main_mod
            importlib.reload(main_mod)

            with TestClient(main_mod.app) as client:
                r_live = client.get("/api/live")
                assert r_live.status_code == 200
                assert r_live.json()["status"] == "alive"

                r_health = client.get("/api/health")
                assert r_health.status_code == 503
                body = r_health.json()
                assert body["status"] == "unavailable"
                assert body["models_ready"] is False
                assert body["validator_ready"] is False

                r_pred = client.post(
                    "/api/predict/oct",
                    files={"file": ("test.png", b"dummy", "image/png")},
                )
                assert r_pred.status_code == 503
                print("  Missing models: /api/live=200, /api/health=503, /api/predict/oct=503 OK")
        finally:
            if orig_model_dir is None:
                os.environ.pop("MODEL_DIR", None)
            else:
                os.environ["MODEL_DIR"] = orig_model_dir
            if orig_backbone is None:
                os.environ.pop("MODALITY_BACKBONE_PATH", None)
            else:
                os.environ["MODALITY_BACKBONE_PATH"] = orig_backbone


def test_production_env_hardening():
    print("=== 2. TESTING PRODUCTION CORS, DOCS TOGGLE & CPU DEVICE ===")
    saved = {k: os.environ.get(k) for k in ["APP_ENV", "ALLOWED_ORIGINS", "ENABLE_DOCS", "NETRADRISHTI_DEVICE"]}
    try:
        os.environ["APP_ENV"] = "production"
        os.environ["ALLOWED_ORIGINS"] = "*,https://netradrishti.azurestaticapps.net"
        os.environ["ENABLE_DOCS"] = "false"
        os.environ["NETRADRISHTI_DEVICE"] = "cpu"

        import inference.predictor as pred_mod
        import backend.main as main_mod
        importlib.reload(pred_mod)
        importlib.reload(main_mod)

        assert str(pred_mod.DEVICE) == "cpu"
        assert "*" not in main_mod.allowed_origins
        assert main_mod.allowed_origins == ["https://netradrishti.azurestaticapps.net"]

        with TestClient(main_mod.app) as client:
            assert client.get("/docs").status_code == 404
            assert client.get("/api/live").status_code == 200
            assert client.get("/api/health").status_code == 200
            print("  Production CORS wildcard stripped, /docs disabled, CPU device active, /api/health=200 OK")
    finally:
        for k, v in saved.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
        # Reload defaults cleanly
        import inference.predictor as pred_mod
        import backend.main as main_mod
        importlib.reload(pred_mod)
        importlib.reload(main_mod)


if __name__ == "__main__":
    test_missing_models_readiness_separation()
    test_production_env_hardening()
    print("\nALL DEPLOYMENT READINESS TESTS PASSED!")

