"""
NetraDrishti — Production-Oriented FastAPI Backend
Integrates trained OCT (Swin-Tiny) and Fundus (EfficientNet-B0 + ResNet-50) models,
OOD-aware image modality guardrails, and authentic Grad-CAM explainability.
"""

import gc
import io
import math
import os
import sys
import logging
import threading
import asyncio
from pathlib import Path
from typing import Any, Callable, Optional
from contextlib import asynccontextmanager

import torch
from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, File, Query, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

# Ensure NetraDrishti root directory is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from inference.predictor import NetraDrishtiPredictor, DEVICE
from inference.modality_validator import ModalityValidator, ModalityValidationResult
from backend.schemas import (
    HealthResponse,
    OCTPredictionResponse,
    FundusPredictionResponse,
    OCTExplanationResponse,
    FundusExplanationResponse,
    DiseaseResult,
)

# Environment-driven configuration
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
LOG_LEVEL_NAME = os.getenv("LOG_LEVEL", "INFO").strip().upper()
LOG_LEVEL = getattr(logging, LOG_LEVEL_NAME, logging.INFO)
ENABLE_DOCS = os.getenv("ENABLE_DOCS", "true").strip().lower() in {"1", "true", "yes"}
MAX_CONCURRENT_INFERENCE = max(1, int(os.getenv("MAX_CONCURRENT_INFERENCE", "4")))
INFERENCE_TIMEOUT_SECONDS = max(5.0, float(os.getenv("INFERENCE_TIMEOUT_SECONDS", "60.0")))

# Configure structured logging (no private paths or sensitive patient data)
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("netradrishti.backend")

# Security and validation constants
MAX_UPLOAD_SIZE = int(os.getenv("MAX_UPLOAD_SIZE_BYTES", 10 * 1024 * 1024))  # 10 MB default
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/jpg"}
DISCLAIMER_TEXT = (
    "NetraDrishti is designed for research and educational purposes only. "
    "It is not certified as a medical diagnostic device and its predictions "
    "should not be used as clinical advice or interpreted as medically calibrated diagnostic certainty. "
    "Always consult a qualified ophthalmologist or healthcare professional for clinical evaluation."
)

# Inference & Grad-CAM thread-safety lock + bounded queue semaphore
inference_lock = threading.Lock()
inference_queue_semaphore: Optional[asyncio.BoundedSemaphore] = None


def _get_queue_semaphore() -> asyncio.BoundedSemaphore:
    global inference_queue_semaphore
    if inference_queue_semaphore is None:
        inference_queue_semaphore = asyncio.BoundedSemaphore(MAX_CONCURRENT_INFERENCE)
    return inference_queue_semaphore


def _detect_cgroup_cpu_limit() -> Optional[int]:
    """Detect Linux container CPU quota (cgroup v2 / v1) to avoid OpenMP thrashing."""
    try:
        v2_path = Path("/sys/fs/cgroup/cpu.max")
        if v2_path.exists():
            parts = v2_path.read_text(encoding="utf-8").strip().split()
            if len(parts) == 2 and parts[0] != "max":
                quota, period = int(parts[0]), int(parts[1])
                if quota > 0 and period > 0:
                    return max(1, math.floor(quota / period))
        v1_quota = Path("/sys/fs/cgroup/cpu/cpu.cfs_quota_us")
        v1_period = Path("/sys/fs/cgroup/cpu/cpu.cfs_period_us")
        if v1_quota.exists() and v1_period.exists():
            quota = int(v1_quota.read_text(encoding="utf-8").strip())
            period = int(v1_period.read_text(encoding="utf-8").strip())
            if quota > 0 and period > 0:
                return max(1, math.floor(quota / period))
    except Exception:
        pass
    return None


def _configure_cpu_threads() -> None:
    if str(DEVICE) != "cpu":
        return
    explicit = os.getenv("TORCH_NUM_THREADS", "").strip()
    if explicit.isdigit() and int(explicit) >= 1:
        target = int(explicit)
    else:
        cgroup_cpus = _detect_cgroup_cpu_limit()
        if cgroup_cpus is None:
            return
        target = cgroup_cpus
    try:
        torch.set_num_threads(target)
        interop_env = os.getenv("TORCH_NUM_INTEROP_THREADS", "1").strip()
        interop = int(interop_env) if interop_env.isdigit() and int(interop_env) >= 1 else 1
        torch.set_num_interop_threads(interop)
    except RuntimeError:
        # Interop thread pool can only be configured once before parallel work starts
        pass
    logger.info(f"Configured PyTorch CPU intra-op threads={torch.get_num_threads()}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager:
    Initializes NetraDrishtiPredictor and ModalityValidator once at startup.
    Reuses initialized models for all subsequent requests.
    """
    global inference_queue_semaphore
    inference_queue_semaphore = asyncio.BoundedSemaphore(MAX_CONCURRENT_INFERENCE)
    _configure_cpu_threads()

    logger.info(
        f"Starting NetraDrishti backend (env={APP_ENV}, max_concurrent={MAX_CONCURRENT_INFERENCE}, timeout={INFERENCE_TIMEOUT_SECONDS}s)..."
    )
    try:
        app.state.predictor = NetraDrishtiPredictor()
        app.state.models_ready = True
        logger.info(f"NetraDrishtiPredictor initialized on device: {DEVICE}")
    except FileNotFoundError as fnf:
        logger.error(f"Model initialization failed: {fnf}")
        app.state.predictor = None
        app.state.models_ready = False
    except Exception:
        logger.error("Failed to initialize NetraDrishtiPredictor.", exc_info=True)
        app.state.predictor = None
        app.state.models_ready = False

    try:
        validator = ModalityValidator(device=DEVICE)
        app.state.modality_validator = validator
        app.state.validator_ready = bool(validator.ready)
        if validator.ready:
            logger.info("ModalityValidator guardrail initialized successfully.")
        else:
            logger.warning(f"ModalityValidator not ready: {validator.load_error}")
    except Exception:
        logger.error("Failed to initialize ModalityValidator.", exc_info=True)
        app.state.modality_validator = None
        app.state.validator_ready = False

    yield

    logger.info("Shutting down NetraDrishti backend service.")


app = FastAPI(
    title="NetraDrishti API — AI Retinal Disease Analysis",
    description=(
        "Production-oriented FastAPI backend for NetraDrishti, integrating deep learning models "
        "for retinal disease analysis from OCT scans and Fundus photographs, modality validation "
        "guardrails, and real Grad-CAM explainability.\n\n"
        "**Disclaimer:** For research and educational purposes only. Not intended for clinical diagnosis."
    ),
    version="1.1.0",
    docs_url="/docs" if ENABLE_DOCS else None,
    redoc_url="/redoc" if ENABLE_DOCS else None,
    openapi_url="/openapi.json" if ENABLE_DOCS else None,
    lifespan=lifespan
)

# Controlled CORS configuration (reject wildcard origins in production)
raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
if APP_ENV == "production":
    if "*" in allowed_origins:
        logger.warning("Wildcard '*' CORS origin removed in production mode.")
    allowed_origins = [o for o in allowed_origins if o != "*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Accept", "Content-Type"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Fallback exception handler: Prevents exposing internal tracebacks or private system paths.
    """
    logger.error(f"Unhandled error on {request.method} {request.url.path}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred while processing the request."}
    )


async def validate_and_load_image(file: UploadFile) -> Image.Image:
    """
    Safely validates and decodes an uploaded image:
    - Enforces 10MB upload limit without memory exhaustion.
    - Validates MIME type and file extension.
    - Guards against decompression bombs.
    - Decodes image strictly in-memory (no persistence).
    """
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext and ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file format '{ext}'. Only JPEG and PNG images are accepted."
            )

    content_type = (file.content_type or "").lower().strip()
    if content_type and content_type not in ALLOWED_MIME_TYPES and content_type != "application/octet-stream":
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type '{content_type}'. Only image/jpeg and image/png are accepted."
        )

    total_bytes = bytearray()
    chunk_size = 1024 * 1024
    while True:
        chunk = await file.read(chunk_size)
        if not chunk:
            break
        total_bytes.extend(chunk)
        if len(total_bytes) > MAX_UPLOAD_SIZE:
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds the maximum allowed limit of {MAX_UPLOAD_SIZE // (1024 * 1024)} MB."
            )

    if len(total_bytes) == 0:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    try:
        Image.MAX_IMAGE_PIXELS = 25_000_000
        stream = io.BytesIO(total_bytes)
        img = Image.open(stream)

        if img.format not in ["JPEG", "PNG"]:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported image format '{img.format}'. Only JPEG and PNG images are accepted."
            )

        img.load()
        return img
    except HTTPException:
        raise
    except Image.DecompressionBombError:
        raise HTTPException(
            status_code=400,
            detail="Image pixel dimensions exceed allowed safety threshold."
        )
    except (UnidentifiedImageError, OSError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is corrupt or is not a valid image."
        )
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="Failed to decode image data."
        )


def _safe_validate_modality(
    validator: ModalityValidator, image: Image.Image
) -> ModalityValidationResult:
    with inference_lock:
        return validator.validate(image)


def _assert_expected_modality(
    res: ModalityValidationResult, expected_modality: str
) -> None:
    """
    Enforces strict modality match before executing downstream disease inference.
    """
    if res.detected_modality == expected_modality:
        return

    metrics = res.metrics or {}
    if expected_modality == "oct":
        if res.detected_modality == "fundus":
            raise HTTPException(
                status_code=422,
                detail="This image does not appear to be a valid retinal OCT scan. Please upload an OCT image."
            )
        cos_oct = metrics.get("oct_cosine", 0.0)
        d_oct = metrics.get("oct_mahalanobis", 99.0)
        if cos_oct >= 0.32 or d_oct <= 30.0:
            raise HTTPException(
                status_code=422,
                detail="Unable to verify the imaging modality. Please check your image and try again."
            )
        raise HTTPException(
            status_code=422,
            detail="This image does not appear to be a valid retinal OCT scan. Please upload an OCT image."
        )

    # expected_modality == "fundus"
    if res.detected_modality == "oct":
        raise HTTPException(
            status_code=422,
            detail="This image does not appear to be a valid retinal Fundus photograph. Please upload a Fundus image."
        )
    cos_fun = metrics.get("fundus_cosine", 0.0)
    d_fun = metrics.get("fundus_mahalanobis", 99.0)
    if cos_fun >= 0.42 or d_fun <= 30.0:
        raise HTTPException(
            status_code=422,
            detail="Unable to verify the imaging modality. Please check your image and try again."
        )
    raise HTTPException(
        status_code=422,
        detail="This image does not appear to be a valid retinal Fundus photograph. Please upload a Fundus image."
    )


def _safe_predict_oct(predictor: NetraDrishtiPredictor, image: Image.Image):
    with inference_lock:
        return predictor.predict_oct(image)


def _safe_predict_fundus(predictor: NetraDrishtiPredictor, image: Image.Image):
    with inference_lock:
        return predictor.predict_fundus(image)


def _safe_explain_oct(
    predictor: NetraDrishtiPredictor, image: Image.Image, target_class: Optional[str]
):
    with inference_lock:
        try:
            return predictor.explain_oct(image, target_class=target_class)
        finally:
            gc.collect()


def _safe_explain_fundus(
    predictor: NetraDrishtiPredictor, image: Image.Image, target_disease: Optional[str]
):
    with inference_lock:
        try:
            return predictor.explain_fundus(image, target_disease=target_disease)
        finally:
            gc.collect()


async def _run_bounded(fn: Callable[..., Any], *args: Any) -> Any:
    """
    Runs blocking CPU/XPU inference inside a worker thread with bounded concurrency
    and request timeout protection.
    """
    sem = _get_queue_semaphore()
    try:
        await asyncio.wait_for(sem.acquire(), timeout=min(5.0, INFERENCE_TIMEOUT_SECONDS))
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=503,
            detail="Inference queue is currently busy. Please retry shortly.",
            headers={"Retry-After": "5"},
        )

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(fn, *args),
            timeout=INFERENCE_TIMEOUT_SECONDS,
        )
    except asyncio.TimeoutError:
        logger.warning("Inference request exceeded configured timeout.")
        raise HTTPException(
            status_code=504,
            detail="Image processing timed out under current load. Please try again.",
        )
    finally:
        sem.release()


async def _prepare_and_guard_image(
    file: UploadFile, expected_modality: str
) -> Image.Image:
    if not getattr(app.state, "models_ready", False) or app.state.predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Model service is currently unavailable. Please try again later."
        )
    if not getattr(app.state, "validator_ready", False) or app.state.modality_validator is None:
        raise HTTPException(
            status_code=503,
            detail="Modality validation guardrail is currently unavailable."
        )

    image = await validate_and_load_image(file)
    validation = await _run_bounded(
        _safe_validate_modality, app.state.modality_validator, image
    )
    _assert_expected_modality(validation, expected_modality)
    return image


@app.get("/", include_in_schema=False)
async def root():
    """Redirect to docs when enabled, or return minimal service metadata."""
    if ENABLE_DOCS:
        return RedirectResponse(url="/docs")
    return {"service": "NetraDrishti API", "status": "ok"}


@app.get(
    "/api/live",
    tags=["System"],
    summary="Container Liveness Probe",
    description="Lightweight process liveness check for Azure Container Apps (independent of model readiness)."
)
async def liveness_check():
    return {"status": "alive"}


@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="API & Model Health Check",
    description="Returns the health status of the API, active compute device, and readiness of models and modality guardrails."
)
async def health_check():
    models_ready = bool(getattr(app.state, "models_ready", False))
    validator_ready = bool(getattr(app.state, "validator_ready", False))
    all_ready = models_ready and validator_ready
    device_str = str(DEVICE)

    if not all_ready:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "models_ready": models_ready,
                "validator_ready": validator_ready,
                "device": device_str,
                "supported_modalities": ["OCT", "Fundus"]
            }
        )

    return HealthResponse(
        status="healthy",
        models_ready=models_ready,
        validator_ready=validator_ready,
        device=device_str,
        supported_modalities=["OCT", "Fundus"]
    )


@app.post(
    "/api/predict/oct",
    response_model=OCTPredictionResponse,
    tags=["Predictions"],
    summary="Predict Retinal OCT Disease",
    description="Validates modality as retinal OCT and returns predicted condition, confidence score, and 4-class distribution."
)
async def predict_oct(
    file: UploadFile = File(..., description="Retinal OCT scan image in JPEG or PNG format (max 10MB)")
):
    image = await _prepare_and_guard_image(file, "oct")

    try:
        result = await _run_bounded(
            _safe_predict_oct, app.state.predictor, image
        )
    except HTTPException:
        raise
    except Exception:
        logger.error("Inference error during OCT prediction.", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An internal server error occurred while processing the OCT scan."
        )

    return OCTPredictionResponse(
        modality="OCT",
        predicted_class=result["predicted_class"],
        confidence=result["confidence"],
        scores=result["scores"],
        disclaimer=DISCLAIMER_TEXT
    )


@app.post(
    "/api/predict/fundus",
    response_model=FundusPredictionResponse,
    tags=["Predictions"],
    summary="Predict Retinal Fundus Multi-Disease",
    description="Validates modality as retinal Fundus and returns prediction scores, thresholds, and detection results for 8 conditions."
)
async def predict_fundus(
    file: UploadFile = File(..., description="Retinal Fundus photograph in JPEG or PNG format (max 10MB)")
):
    image = await _prepare_and_guard_image(file, "fundus")

    try:
        result = await _run_bounded(
            _safe_predict_fundus, app.state.predictor, image
        )
    except HTTPException:
        raise
    except Exception:
        logger.error("Inference error during Fundus prediction.", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="An internal server error occurred while processing the Fundus image."
        )

    predictions = {
        disease: DiseaseResult(
            score=data["score"],
            threshold=data["threshold"],
            detected=data["detected"]
        )
        for disease, data in result.items()
    }

    return FundusPredictionResponse(
        modality="Fundus",
        predictions=predictions,
        disclaimer=DISCLAIMER_TEXT
    )


@app.post(
    "/api/explain/oct",
    response_model=OCTExplanationResponse,
    tags=["Explainability"],
    summary="Generate OCT Swin-Tiny Grad-CAM Explanation",
    description=(
        "Validates modality as retinal OCT and computes real class-specific Swin-Tiny Grad-CAM "
        "attribution over retinal tissue with padding masked out."
    )
)
async def explain_oct(
    file: UploadFile = File(..., description="Retinal OCT scan image in JPEG or PNG format (max 10MB)"),
    target_class: Optional[str] = Query(
        default=None,
        description="Optional target OCT class (CNV, DME, DRUSEN, NORMAL). Defaults to predicted class."
    ),
):
    image = await _prepare_and_guard_image(file, "oct")

    try:
        result = await _run_bounded(
            _safe_explain_oct, app.state.predictor, image, target_class
        )
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception:
        logger.error("Error generating OCT Grad-CAM explanation.", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate Grad-CAM explanation for this OCT image."
        )

    return OCTExplanationResponse(
        **result,
        disclaimer=DISCLAIMER_TEXT,
    )


@app.post(
    "/api/explain/fundus",
    response_model=FundusExplanationResponse,
    tags=["Explainability"],
    summary="Generate Fundus Ensemble Grad-CAM Explanation",
    description=(
        "Validates modality as retinal Fundus and generates disease-specific Grad-CAM maps from "
        "EfficientNet-B0, ResNet-50, and their 50/50 weighted ensemble visualization."
    )
)
async def explain_fundus(
    file: UploadFile = File(..., description="Retinal Fundus photograph in JPEG or PNG format (max 10MB)"),
    disease: Optional[str] = Query(
        default=None,
        description="Optional target disease code (DR, MH, ODC, TSLN, DN, MYA, ARMD, BRVO). Defaults to top detected/highest-scoring disease."
    ),
):
    image = await _prepare_and_guard_image(file, "fundus")

    try:
        result = await _run_bounded(
            _safe_explain_fundus, app.state.predictor, image, disease
        )
    except HTTPException:
        raise
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception:
        logger.error("Error generating Fundus Grad-CAM explanation.", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Unable to generate Grad-CAM explanation for this Fundus image."
        )

    predictions = {
        code: DiseaseResult(
            score=data["score"],
            threshold=data["threshold"],
            detected=data["detected"],
        )
        for code, data in result["predictions"].items()
    }

    return FundusExplanationResponse(
        modality=result["modality"],
        selected_disease=result["selected_disease"],
        selected_score=result["selected_score"],
        selected_threshold=result["selected_threshold"],
        selected_detected=result["selected_detected"],
        predictions=predictions,
        efficientnet_heatmap=result["efficientnet_heatmap"],
        resnet_heatmap=result["resnet_heatmap"],
        combined_heatmap=result["combined_heatmap"],
        combined_overlay=result["combined_overlay"],
        model_weights=result["model_weights"],
        explanation_meta=result["explanation_meta"],
        disclaimer=DISCLAIMER_TEXT,
    )
