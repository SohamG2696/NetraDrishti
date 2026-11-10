<#
.SYNOPSIS
  NetraDrishti — Minimum-Cost Azure Deployment Runbook (PowerShell)
  Target Architecture:
    - Model Assets: Bundled inside Backend Docker image under /app/models
    - Registry:     Private Docker Hub repo ($0/mo free personal tier) or GHCR ($0/mo)
    - Backend API:  Azure Container Apps Consumption (1.0 vCPU / 2.0 GiB, minReplicas=0, maxReplicas=1)
    - Frontend UI:  Azure Static Web Apps Free

.NOTES
  Review every placeholder below before running.
  Do not commit registry PATs or tokens to Git.
#>

$ErrorActionPreference = "Stop"

# --- 1. Configure Deployment & Container Image Settings ---
$RESOURCE_GROUP     = "rg-netradrishti-prod"
$LOCATION           = "centralindia"   # Choose nearest region supporting ACA + SWA (e.g., centralindia, eastus2, westeurope)
$ACA_ENV            = "cae-netradrishti"
$ACA_APP            = "ca-netradrishti-api"

# Default: Private Docker Hub repository (1 free private repo on Docker Hub Personal Free)
# Alternative: $REGISTRY_SERVER = "ghcr.io"; $IMAGE_REPO = "sohamg2696/netradrishti-backend"
$REGISTRY_SERVER    = "index.docker.io"
$REGISTRY_USERNAME  = "sohamg2696"
$IMAGE_REPO         = "$REGISTRY_USERNAME/netradrishti-backend"
$IMAGE_TAG          = "v1.0.0"
$FULL_IMAGE         = "$REGISTRY_SERVER/$IMAGE_REPO`:$IMAGE_TAG"
$SWA_ORIGIN         = "https://<YOUR_SWA_HOSTNAME>.azurestaticapps.net"

# --- 2. Stage Bundled Model Artifacts & Build Self-Contained Docker Image ---
$CacheBackbone = "$env:USERPROFILE\.cache\torch\hub\checkpoints\efficientnet_b0_rwightman-7f5810bc.pth"
$LocalBackbone = "models\efficientnet_b0_rwightman-7f5810bc.pth"
if (-not (Test-Path $LocalBackbone) -and (Test-Path $CacheBackbone)) {
  Copy-Item -Path $CacheBackbone -Destination $LocalBackbone -Force
}

$RequiredArtifacts = @(
  "models\swin_tiny_epoch3.pth",
  "models\netradrishti_fundus_ensemble.pth",
  "models\modality_validator_stats.npz",
  "models\efficientnet_b0_rwightman-7f5810bc.pth"
)
foreach ($artifact in $RequiredArtifacts) {
  if (-not (Test-Path $artifact)) {
    throw "Missing required model artifact for Docker build: $artifact"
  }
}

docker build -t $FULL_IMAGE .
# Ensure repository '$IMAGE_REPO' is marked Private on Docker Hub / GHCR before pushing if restricting weights.
docker push $FULL_IMAGE

# --- 3. Authenticate to Azure & Provision Container Apps Consumption Environment ---
az login
az group create --name $RESOURCE_GROUP --location $LOCATION

az containerapp env create `
  --name $ACA_ENV `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION

# Supply a read-only Personal Access Token (PAT) for private registry pulls without saving it to disk
$SecurePat = Read-Host "Enter read-only PAT for $REGISTRY_SERVER ($REGISTRY_USERNAME)" -AsSecureString
$Bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecurePat)
$RegistryPat = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($Bstr)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)

try {
  az containerapp create `
    --name $ACA_APP `
    --resource-group $RESOURCE_GROUP `
    --environment $ACA_ENV `
    --image $FULL_IMAGE `
    --registry-server $REGISTRY_SERVER `
    --registry-username $REGISTRY_USERNAME `
    --registry-password $RegistryPat `
    --ingress external `
    --target-port 8000 `
    --cpu 1.0 `
    --memory 2.0Gi `
    --min-replicas 0 `
    --max-replicas 1 `
    --env-vars `
      APP_ENV=production `
      PORT=8000 `
      LOG_LEVEL=INFO `
      ENABLE_DOCS=true `
      NETRADRISHTI_DEVICE=cpu `
      TORCH_NUM_THREADS=1 `
      OMP_NUM_THREADS=1 `
      MODEL_DIR=/app/models `
      MAX_UPLOAD_SIZE_BYTES=10485760 `
      MAX_CONCURRENT_INFERENCE=4 `
      INFERENCE_TIMEOUT_SECONDS=60.0 `
      ALLOWED_ORIGINS="$SWA_ORIGIN"
}
finally {
  $RegistryPat = $null
}

$BACKEND_FQDN = az containerapp show --name $ACA_APP --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "Backend HTTPS URL: https://$BACKEND_FQDN"

# --- 4. Build Frontend & Deploy to Azure Static Web Apps (Free Plan) ---
# Build frontend pointing at the Container App HTTPS URL:
#   Push-Location frontend
#   $env:VITE_API_BASE_URL = "https://$BACKEND_FQDN"
#   npm ci
#   npm run build
#   Pop-Location
# Deploy `frontend/dist` to Azure Static Web Apps Free (Portal / GitHub Actions / `npx @azure/static-web-apps-cli deploy`).
# Update ALLOWED_ORIGINS once the assigned `*.azurestaticapps.net` URL is known:
#   az containerapp update --name $ACA_APP --resource-group $RESOURCE_GROUP --set-env-vars ALLOWED_ORIGINS="https://<YOUR_SWA_HOSTNAME>.azurestaticapps.net"
