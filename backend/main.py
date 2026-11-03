"""
NetraDrishti — Production-Oriented FastAPI Backend
Integrates trained OCT (Swin-Tiny) and Fundus (EfficientNet-B0 + ResNet-50) models.
"""

import io
import os
import sys
import logging
import threading
import asyncio
from pathlib import Path
from contextlib import asynccontextmanager

from PIL import Image, UnidentifiedImageError
from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

# Ensure NetraDrishti root directory is in sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from inference.predictor import NetraDrishtiPredictor, DEVICE
from backend.schemas import (
    HealthResponse,
    OCTPredictionResponse,
    FundusPredictionResponse,
    DiseaseResult,
)

# Configure structured logging (no private paths or sensitive patient data)
logging.basicConfig(
    level=logging.INFO,
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

# Inference thread-safety lock for concurrent execution
inference_lock = threading.Lock()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan context manager:
    Initializes NetraDrishtiPredictor once at startup.
    Reuses initialized models for all subsequent requests.
    """
    logger.info("Initializing NetraDrishtiPredictor and loading model weights...")
    try:
        app.state.predictor = NetraDrishtiPredictor()
        app.state.models_ready = True
        logger.info(f"NetraDrishtiPredictor successfully initialized on device: {DEVICE}")
    except Exception as e:
        logger.error(f"Failed to initialize NetraDrishtiPredictor: {e}", exc_info=True)
        app.state.predictor = None
        app.state.models_ready = False

    yield

    logger.info("Shutting down NetraDrishti backend service.")


app = FastAPI(
    title="NetraDrishti API — AI Retinal Disease Analysis",
    description=(
        "Production-oriented FastAPI backend for NetraDrishti, integrating deep learning models "
        "for retinal disease analysis from OCT scans and Fundus photographs.\n\n"
        "**Disclaimer:** For research and educational purposes only. Not intended for clinical diagnosis."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Controlled CORS configuration
raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Fallback exception handler: Prevents exposing internal tracebacks or private system paths.
    """
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
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
    # 1. Validate file extension if filename is present
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext and ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file format '{ext}'. Only JPEG and PNG images are accepted."
            )

    # 2. Validate MIME type header if provided
    content_type = (file.content_type or "").lower().strip()
    if content_type and content_type not in ALLOWED_MIME_TYPES and content_type != "application/octet-stream":
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported media type '{content_type}'. Only image/jpeg and image/png are accepted."
        )

    # 3. Read file stream in chunks to enforce size limit securely
    total_bytes = bytearray()
    chunk_size = 1024 * 1024  # 1 MB chunk
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

    # 4. Safe image decoding using Pillow with decompression bomb guard
    try:
        # Cap max pixels to guard against decompression bombs
        Image.MAX_IMAGE_PIXELS = 25_000_000
        stream = io.BytesIO(total_bytes)
        img = Image.open(stream)

        # Confirm decoded image format is JPEG or PNG
        if img.format not in ["JPEG", "PNG"]:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported image format '{img.format}'. Only JPEG and PNG images are accepted."
            )

        # Force raster decoding to detect corrupted, truncated, or malformed data
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


def _safe_predict_oct(predictor: NetraDrishtiPredictor, image: Image.Image):
    with inference_lock:
        return predictor.predict_oct(image)


def _safe_predict_fundus(predictor: NetraDrishtiPredictor, image: Image.Image):
    with inference_lock:
        return predictor.predict_fundus(image)


@app.get(
    "/",
    include_in_schema=False
)
async def root():
    """Redirect root path to interactive Swagger documentation."""
    return RedirectResponse(url="/docs")


@app.get(
    "/api/health",
    response_model=HealthResponse,
    tags=["System"],
    summary="API & Model Health Check",
    description="Returns the health status of the API, active compute device, and model readiness."
)
async def health_check():
    models_ready = bool(getattr(app.state, "models_ready", False))
    device_str = str(DEVICE)

    if not models_ready:
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "models_ready": False,
                "device": device_str,
                "supported_modalities": ["OCT", "Fundus"]
            }
        )

    return HealthResponse(
        status="healthy",
        models_ready=True,
        device=device_str,
        supported_modalities=["OCT", "Fundus"]
    )


@app.post(
    "/api/predict/oct",
    response_model=OCTPredictionResponse,
    tags=["Predictions"],
    summary="Predict Retinal OCT Disease",
    description="Accepts a retinal OCT scan (JPEG/PNG) and returns predicted condition, confidence score, and 4-class distribution."
)
async def predict_oct(
    file: UploadFile = File(..., description="Retinal OCT scan image in JPEG or PNG format (max 10MB)")
):
    if not getattr(app.state, "models_ready", False) or app.state.predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Model service is currently unavailable. Please try again later."
        )

    image = await validate_and_load_image(file)

    try:
        result = await asyncio.to_thread(
            _safe_predict_oct, app.state.predictor, image
        )
    except Exception as e:
        logger.error(f"Inference error during OCT prediction: {e}", exc_info=True)
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
    description="Accepts a retinal Fundus photograph (JPEG/PNG) and returns prediction scores, thresholds, and detection results for 8 conditions."
)
async def predict_fundus(
    file: UploadFile = File(..., description="Retinal Fundus photograph in JPEG or PNG format (max 10MB)")
):
    if not getattr(app.state, "models_ready", False) or app.state.predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Model service is currently unavailable. Please try again later."
        )

    image = await validate_and_load_image(file)

    try:
        result = await asyncio.to_thread(
            _safe_predict_fundus, app.state.predictor, image
        )
    except Exception as e:
        logger.error(f"Inference error during Fundus prediction: {e}", exc_info=True)
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

