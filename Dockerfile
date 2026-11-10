# ==============================================================================
# NetraDrishti — Production Backend Dockerfile (Linux CPU)
# Target Platform: Azure Container Apps
# ==============================================================================
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    APP_ENV=production \
    NETRADRISHTI_DEVICE=cpu \
    OMP_NUM_THREADS=1 \
    MKL_NUM_THREADS=1 \
    OPENBLAS_NUM_THREADS=1 \
    TORCH_NUM_THREADS=1 \
    TORCH_NUM_INTEROP_THREADS=1 \
    MODEL_DIR=/app/models \
    TORCH_HOME=/app/.cache/torch \
    PORT=8000

WORKDIR /app

# Install minimal OS libraries required by Pillow / opencv-python-headless / healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only PyTorch & torchvision first to prevent CUDA/XPU bloat
RUN pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    "torch>=2.5.0,<3.0.0" \
    "torchvision>=0.20.0,<1.0.0"

# Install remaining backend, FastAPI, Pillow & OpenCV runtime dependencies
COPY requirements-prod.txt ./
RUN pip install --no-cache-dir -r requirements-prod.txt

# Copy backend, inference engine, model stats, and startup bootstrapper
COPY backend/ ./backend/
COPY inference/ ./inference/
COPY models/modality_validator_stats.npz ./models/modality_validator_stats.npz
COPY scripts/fetch_models.py ./scripts/fetch_models.py
COPY scripts/entrypoint.sh ./scripts/entrypoint.sh

# Normalize line endings on entrypoint.sh and set permissions
RUN sed -i 's/\r$//' /app/scripts/entrypoint.sh && \
    chmod +x /app/scripts/entrypoint.sh && \
    groupadd --system appgroup && \
    useradd --system --gid appgroup --create-home appuser && \
    mkdir -p /app/models /app/.cache/torch/hub/checkpoints && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

# Container liveness check (separate from model readiness /api/health)
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/api/live" || exit 1

ENTRYPOINT ["/app/scripts/entrypoint.sh"]
