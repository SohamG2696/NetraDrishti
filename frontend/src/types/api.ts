/**
 * API Type Definitions for NetraDrishti
 * Aligned with backend/schemas.py
 */

export type Modality = 'OCT' | 'Fundus';

export interface HealthResponse {
  status: 'healthy' | 'unavailable' | string;
  models_ready: boolean;
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

