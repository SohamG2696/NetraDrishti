<#
.SYNOPSIS
  NetraDrishti — Azure Deployment Runbook (PowerShell)
  Target Architecture:
    - Model Assets: Azure Blob Storage (Private Container + Managed Identity)
    - Backend API:  Azure Container Apps (Linux CPU)
    - Frontend UI:  Azure Static Web Apps

.NOTES
  Review every placeholder below before running.
  This script is NOT executed automatically during Phase 4 readiness prep.
#>

$ErrorActionPreference = "Stop"

# --- 1. Configure Unique Deployment Names ---
$RESOURCE_GROUP     = "rg-netradrishti-prod"
$LOCATION           = "centralindia"   # Choose nearest region supporting ACA + SWA (e.g., eastus2, centralindia, westeurope)
$STORAGE_ACCOUNT    = "stnetradrishti<unique4digits>"  # Must be globally unique, lowercase alphanumeric, 3-24 chars
$BLOB_CONTAINER     = "models"
$ACR_NAME           = "acrnetradrishti<unique4digits>" # Globally unique alphanumeric
$ACA_ENV            = "cae-netradrishti"
$ACA_APP            = "ca-netradrishti-api"
$IMAGE_TAG          = "v1.0.0"

# --- 2. Authenticate & Create Resource Group ---
az login
az group create --name $RESOURCE_GROUP --location $LOCATION

# --- 3. Create Private Azure Blob Storage & Upload Model Assets ---
az storage account create `
  --name $STORAGE_ACCOUNT `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION `
  --sku Standard_LRS `
  --kind StorageV2 `
  --allow-blob-public-access false `
  --min-tls-version TLS1_2

az storage container create `
  --name $BLOB_CONTAINER `
  --account-name $STORAGE_ACCOUNT `
  --auth-mode login `
  --public-access off

# Upload required checkpoints + ImageNet modality validator backbone
$CACHE_BACKBONE = "$env:USERPROFILE\.cache\torch\hub\checkpoints\efficientnet_b0_rwightman-7f5810bc.pth"
az storage blob upload --account-name $STORAGE_ACCOUNT --container-name $BLOB_CONTAINER --name "swin_tiny_epoch3.pth" --file "models\swin_tiny_epoch3.pth" --auth-mode login --overwrite
az storage blob upload --account-name $STORAGE_ACCOUNT --container-name $BLOB_CONTAINER --name "netradrishti_fundus_ensemble.pth" --file "models\netradrishti_fundus_ensemble.pth" --auth-mode login --overwrite
az storage blob upload --account-name $STORAGE_ACCOUNT --container-name $BLOB_CONTAINER --name "modality_validator_stats.npz" --file "models\modality_validator_stats.npz" --auth-mode login --overwrite
az storage blob upload --account-name $STORAGE_ACCOUNT --container-name $BLOB_CONTAINER --name "efficientnet_b0_rwightman-7f5810bc.pth" --file $CACHE_BACKBONE --auth-mode login --overwrite

# --- 4. Create Azure Container Registry & Build Linux CPU Image in Cloud ---
az acr create --resource-group $RESOURCE_GROUP --name $ACR_NAME --sku Basic --admin-enabled false
az acr build --registry $ACR_NAME --image "netradrishti-backend:$IMAGE_TAG" .

# --- 5. Create Container Apps Environment & Backend App with Managed Identity ---
az containerapp env create `
  --name $ACA_ENV `
  --resource-group $RESOURCE_GROUP `
  --location $LOCATION

az containerapp create `
  --name $ACA_APP `
  --resource-group $RESOURCE_GROUP `
  --environment $ACA_ENV `
  --image "$ACR_NAME.azurecr.io/netradrishti-backend:$IMAGE_TAG" `
  --system-assigned `
  --registry-server "$ACR_NAME.azurecr.io" `
  --registry-identity system `
  --ingress external `
  --target-port 8000 `
  --cpu 1.0 `
  --memory 2.0Gi `
  --min-replicas 0 `
  --max-replicas 2 `
  --env-vars `
    APP_ENV=production `
    PORT=8000 `
    LOG_LEVEL=INFO `
    ENABLE_DOCS=true `
    NETRADRISHTI_DEVICE=cpu `
    MODEL_DIR=/app/models `
    MAX_UPLOAD_SIZE_BYTES=10485760 `
    MAX_CONCURRENT_INFERENCE=4 `
    INFERENCE_TIMEOUT_SECONDS=60.0 `
    AZURE_STORAGE_BLOB_BASE_URL="https://$STORAGE_ACCOUNT.blob.core.windows.net/$BLOB_CONTAINER" `
    AZURE_USE_MANAGED_IDENTITY=true `
    ALLOWED_ORIGINS="https://<YOUR_SWA_HOSTNAME>.azurestaticapps.net"

# Grant Container App Managed Identity read permissions on Storage Container & ACR Pull
$PRINCIPAL_ID = az containerapp show --name $ACA_APP --resource-group $RESOURCE_GROUP --query "identity.principalId" -o tsv
$STORAGE_ID   = az storage account show --name $STORAGE_ACCOUNT --resource-group $RESOURCE_GROUP --query "id" -o tsv
$ACR_ID       = az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "id" -o tsv

az role assignment create --assignee $PRINCIPAL_ID --role "Storage Blob Data Reader" --scope $STORAGE_ID
az role assignment create --assignee $PRINCIPAL_ID --role "AcrPull" --scope $ACR_ID

$BACKEND_FQDN = az containerapp show --name $ACA_APP --resource-group $RESOURCE_GROUP --query "properties.configuration.ingress.fqdn" -o tsv
Write-Host "Backend HTTPS URL: https://$BACKEND_FQDN"

# --- 6. Build Frontend & Deploy to Azure Static Web Apps ---
# Configure VITE_API_BASE_URL=https://$BACKEND_FQDN before running npm run build
# In Azure Portal / SWA CLI:
#   App location:    frontend
#   Output location: dist
#   Build command:   npm run build
# After SWA URL is known, update ALLOWED_ORIGINS on Container App:
#   az containerapp update --name $ACA_APP --resource-group $RESOURCE_GROUP --set-env-vars ALLOWED_ORIGINS="https://<SWA_HOSTNAME>"

