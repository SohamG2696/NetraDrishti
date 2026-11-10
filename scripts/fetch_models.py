"""
[INACTIVE / OPTIONAL LEGACY UTILITY]
Startup model-asset bootstrapper for external Azure Blob Storage deployments.

The active NetraDrishti production Dockerfile bundles all 4 model artifacts
directly into /app/models at build time, so scripts/entrypoint.sh does NOT
invoke this script and Azure Blob Storage is not required. Retained only if an
operator later switches back to external Blob-hosted checkpoints.

Checks MODEL_DIR for required checkpoint files:
  - swin_tiny_epoch3.pth
  - netradrishti_fundus_ensemble.pth
  - efficientnet_b0_rwightman-7f5810bc.pth
  - modality_validator_stats.npz

If any file is missing and Azure Blob Storage configuration is provided via
environment variables (Managed Identity or Secret SAS query), downloads missing
artifacts securely over HTTPS before Uvicorn starts. Never logs tokens or URLs
containing query parameters.
"""

import hashlib
import json
import logging
import os
import shutil
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] fetch_models: %(message)s")
logger = logging.getLogger("netradrishti.fetch_models")

REQUIRED_MODELS = {
    "swin_tiny_epoch3.pth": "MODEL_SHA256_SWIN_OCT",
    "netradrishti_fundus_ensemble.pth": "MODEL_SHA256_FUNDUS_ENSEMBLE",
    "efficientnet_b0_rwightman-7f5810bc.pth": "MODEL_SHA256_MODALITY_BACKBONE",
    "modality_validator_stats.npz": "MODEL_SHA256_MODALITY_STATS",
}


def _get_managed_identity_token() -> Optional[str]:
    """
    Fetch an Azure AD access token for Azure Storage from Azure Container Apps
    / App Service Managed Identity endpoint (IDENTITY_ENDPOINT + IDENTITY_HEADER)
    or standard Azure IMDS endpoint.
    """
    resource = "https://storage.azure.com/"
    identity_endpoint = os.getenv("IDENTITY_ENDPOINT", "").strip()
    identity_header = os.getenv("IDENTITY_HEADER", "").strip()

    if identity_endpoint and identity_header:
        query = urllib.parse.urlencode({"api-version": "2019-08-01", "resource": resource})
        req = urllib.request.Request(
            f"{identity_endpoint}?{query}",
            headers={"X-IDENTITY-HEADER": identity_header},
        )
    else:
        query = urllib.parse.urlencode({"api-version": "2018-02-01", "resource": resource})
        req = urllib.request.Request(
            f"http://169.254.169.254/metadata/identity/oauth2/token?{query}",
            headers={"Metadata": "true"},
        )

    with urllib.request.urlopen(req, timeout=10) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
        return payload.get("access_token")


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().lower()


def _download_blob(url: str, dest: Path, headers: Dict[str, str], expected_sha256: str = "") -> None:
    tmp = dest.with_suffix(dest.suffix + ".tmp")
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as resp, open(tmp, "wb") as out:
            shutil.copyfileobj(resp, out, length=1024 * 1024)
        if tmp.stat().st_size == 0:
            raise ValueError(f"Downloaded file {dest.name} is empty.")
        if expected_sha256:
            actual = _sha256_file(tmp)
            if actual != expected_sha256.lower():
                raise ValueError(
                    f"SHA-256 mismatch for {dest.name}: expected {expected_sha256}, got {actual}"
                )
        tmp.replace(dest)
    except Exception:
        if tmp.exists():
            tmp.unlink(missing_ok=True)
        raise


def _is_present(model_dir: Path, filename: str) -> bool:
    if (model_dir / filename).exists():
        return True
    if filename == "efficientnet_b0_rwightman-7f5810bc.pth":
        torch_home = Path(os.getenv("TORCH_HOME", str(Path.home() / ".cache" / "torch")))
        if (torch_home / "hub" / "checkpoints" / filename).exists():
            return True
    return False


def main() -> int:
    model_dir = Path(os.getenv("MODEL_DIR", "/app/models"))
    model_dir.mkdir(parents=True, exist_ok=True)

    missing = [name for name in REQUIRED_MODELS if not _is_present(model_dir, name)]
    if not missing:
        logger.info("All required model assets are already present in MODEL_DIR.")
        return 0

    base_url = os.getenv("AZURE_STORAGE_BLOB_BASE_URL", "").strip().rstrip("/")
    if not base_url:
        logger.warning(
            f"Missing model assets ({', '.join(missing)}) and AZURE_STORAGE_BLOB_BASE_URL is not set. "
            "Service will start with readiness=503 until assets are mounted or provided."
        )
        return 0

    use_mi = os.getenv("AZURE_USE_MANAGED_IDENTITY", "false").strip().lower() in {"1", "true", "yes"}
    sas_query = os.getenv("AZURE_BLOB_SAS_QUERY", "").strip().lstrip("?")

    headers: Dict[str, str] = {}
    if use_mi:
        try:
            token = _get_managed_identity_token()
            if not token:
                raise RuntimeError("Empty Managed Identity token received.")
            headers = {
                "Authorization": f"Bearer {token}",
                "x-ms-version": "2020-10-02",
            }
            logger.info("Authenticated to Azure Blob Storage using Managed Identity.")
        except Exception as exc:
            logger.error(f"Managed Identity token acquisition failed: {exc}")
            return 0
    elif not sas_query:
        logger.warning(
            "AZURE_STORAGE_BLOB_BASE_URL is configured without Managed Identity or SAS token; "
            "attempting anonymous blob fetch only if container allows it."
        )

    for filename in missing:
        dest = model_dir / filename
        sha_env = REQUIRED_MODELS[filename]
        expected_sha = os.getenv(sha_env, "").strip()
        blob_url = f"{base_url}/{filename}"
        if sas_query and not use_mi:
            blob_url = f"{blob_url}?{sas_query}"

        logger.info(f"Fetching missing model asset: {filename}")
        try:
            _download_blob(blob_url, dest, headers=headers, expected_sha256=expected_sha)
            size_mb = dest.stat().st_size / (1024 * 1024)
            logger.info(f"Downloaded {filename} successfully ({size_mb:.2f} MB).")
        except urllib.error.HTTPError as http_err:
            logger.error(f"HTTP {http_err.code} while downloading {filename}. Check Blob permissions/SAS.")
        except Exception as exc:
            logger.error(f"Failed to download {filename}: {exc}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

