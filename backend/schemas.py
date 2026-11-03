"""
Pydantic response and request models for NetraDrishti API.
"""

from typing import Dict, List
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str = Field(
        ...,
        description="Current service health status ('healthy' or 'unavailable')",
        examples=["healthy"]
    )
    models_ready: bool = Field(
        ...,
        description="Whether the ML models are initialized and ready for inference",
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

