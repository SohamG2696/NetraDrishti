"""
Pydantic response and request models for NetraDrishti API.
"""

from typing import Any, Dict, List
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(
        ...,
        description="Current service health status ('healthy' or 'unavailable')",
        examples=["healthy"]
    )
    models_ready: bool = Field(
        ...,
        description="Whether the ML disease models are initialized and ready for inference",
        examples=[True]
    )
    validator_ready: bool = Field(
        default=False,
        description="Whether the image modality guardrail validator is initialized and ready",
        examples=[True]
    )
    device: str = Field(
        ...,
        description="Compute device hosting the models (e.g. 'cpu' or 'xpu')",
        examples=["cpu"]
    )
    supported_modalities: List[str] = Field(
        default=["OCT", "Fundus"],
        description="Supported imaging modalities",
        examples=[["OCT", "Fundus"]]
    )


class OCTPredictionResponse(BaseModel):
    modality: str = Field(
        default="OCT",
        description="Imaging modality analyzed",
        examples=["OCT"]
    )
    predicted_class: str = Field(
        ...,
        description="Highest-scoring predicted OCT condition (CNV, DME, DRUSEN, NORMAL)",
        examples=["CNV"]
    )
    confidence: float = Field(
        ...,
        description="Softmax confidence score for the predicted condition (0.0 to 1.0)",
        examples=[0.9914]
    )
    scores: Dict[str, float] = Field(
        ...,
        description="Normalized softmax probability scores across all 4 OCT classes",
        examples=[{"CNV": 0.9914, "DME": 0.0061, "DRUSEN": 0.0017, "NORMAL": 0.0008}]
    )
    disclaimer: str = Field(
        ...,
        description="Educational and research use disclaimer"
    )


class DiseaseResult(BaseModel):
    score: float = Field(
        ...,
        description="Ensemble Sigmoid score for the disease condition (0.0 to 1.0)",
        examples=[0.9525]
    )
    threshold: float = Field(
        ...,
        description="Calibrated decision threshold for classification",
        examples=[0.764]
    )
    detected: bool = Field(
        ...,
        description="Whether the ensemble score equals or exceeds the disease threshold",
        examples=[True]
    )


class FundusPredictionResponse(BaseModel):
    modality: str = Field(
        default="Fundus",
        description="Imaging modality analyzed",
        examples=["Fundus"]
    )
    predictions: Dict[str, DiseaseResult] = Field(
        ...,
        description="Inference results across all 8 supported RFMiD retinal disease categories"
    )
    disclaimer: str = Field(
        ...,
        description="Educational and research use disclaimer"
    )


class OCTExplanationResponse(BaseModel):
    modality: str = Field(default="OCT", description="Imaging modality analyzed")
    predicted_class: str = Field(..., description="Top predicted OCT class")
    selected_class: str = Field(..., description="Class targeted for Grad-CAM attribution")
    confidence: float = Field(..., description="Top predicted class Softmax score")
    selected_score: float = Field(..., description="Softmax score for selected_class")
    scores: Dict[str, float] = Field(..., description="Softmax scores across all 4 OCT classes")
    heatmap: str = Field(..., description="Base64 PNG data URL of tissue-aligned Grad-CAM heatmap")
    overlay: str = Field(..., description="Base64 PNG data URL of Grad-CAM overlay on OCT scan")
    explanation_meta: Dict[str, Any] = Field(
        ..., description="Layer target, gradient diagnostics, and padding-masking metadata"
    )
    disclaimer: str = Field(..., description="Educational and research use disclaimer")


class FundusExplanationResponse(BaseModel):
    modality: str = Field(default="Fundus", description="Imaging modality analyzed")
    selected_disease: str = Field(..., description="Disease label targeted for Grad-CAM")
    selected_score: float = Field(..., description="Ensemble score for selected_disease")
    selected_threshold: float = Field(..., description="Decision threshold for selected_disease")
    selected_detected: bool = Field(..., description="Whether selected_disease met threshold")
    predictions: Dict[str, DiseaseResult] = Field(
        ..., description="All 8 ensemble disease scores, thresholds, and detection flags"
    )
    efficientnet_heatmap: str = Field(
        ..., description="Base64 PNG data URL of EfficientNet-B0 Grad-CAM"
    )
    resnet_heatmap: str = Field(
        ..., description="Base64 PNG data URL of ResNet-50 Grad-CAM"
    )
    combined_heatmap: str = Field(
        ..., description="Base64 PNG data URL of weighted combined visualization"
    )
    combined_overlay: str = Field(
        ..., description="Base64 PNG data URL of combined heatmap overlaid on Fundus image"
    )
    model_weights: Dict[str, float] = Field(
        ..., description="Saved ensemble weights applied to combine individual heatmaps"
    )
    explanation_meta: Dict[str, Any] = Field(
        ..., description="Target layers, gradient diagnostics, and ensemble blending notes"
    )
    disclaimer: str = Field(..., description="Educational and research use disclaimer")
