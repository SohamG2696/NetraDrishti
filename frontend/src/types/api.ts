/**
 * API Type Definitions for NetraDrishti
 * Aligned with backend/schemas.py
 */

export type Modality = 'OCT' | 'Fundus';

export interface HealthResponse {
  status: 'healthy' | 'unavailable' | string;
  models_ready: boolean;
  validator_ready?: boolean;
  device: string;
  supported_modalities: string[];
}

export interface OCTPredictionResponse {
  modality: 'OCT';
  predicted_class: 'CNV' | 'DME' | 'DRUSEN' | 'NORMAL' | string;
  confidence: number;
  scores: Record<string, number>;
  disclaimer: string;
}

export interface DiseaseResult {
  score: number;
  threshold: number;
  detected: boolean;
}

export interface FundusPredictionResponse {
  modality: 'Fundus';
  predictions: Record<string, DiseaseResult>;
  disclaimer: string;
}

export interface OCTExplanationResponse {
  modality: 'OCT';
  predicted_class: string;
  selected_class: string;
  confidence: number;
  selected_score: number;
  scores: Record<string, number>;
  heatmap: string;
  overlay: string;
  explanation_meta: Record<string, unknown>;
  disclaimer: string;
}

export interface FundusExplanationResponse {
  modality: 'Fundus';
  selected_disease: string;
  selected_score: number;
  selected_threshold: number;
  selected_detected: boolean;
  predictions: Record<string, DiseaseResult>;
  efficientnet_heatmap: string;
  resnet_heatmap: string;
  combined_heatmap: string;
  combined_overlay: string;
  model_weights: {
    efficientnet: number;
    resnet: number;
  };
  explanation_meta: Record<string, unknown>;
  disclaimer: string;
}

export interface ApiErrorResponse {
  detail?: string;
  message?: string;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  width?: number;
  height?: number;
}
