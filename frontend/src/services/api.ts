/**
 * NetraDrishti API Service Client
 * Handles communication with the FastAPI backend
 */

import type {
  HealthResponse,
  OCTPredictionResponse,
  FundusPredictionResponse,
  OCTExplanationResponse,
  FundusExplanationResponse,
} from '../types/api';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `Server returned HTTP ${response.status}`;
    try {
      const data = await response.json();
      if (data && typeof data.detail === 'string') {
        detail = data.detail;
      } else if (data && typeof data.message === 'string') {
        detail = data.message;
      }
    } catch {
      // JSON parse failed; use default text
    }

    if (response.status === 413) {
      detail = 'The uploaded image exceeds the 10 MB limit.';
    } else if (response.status === 415) {
      detail = detail || 'Unsupported media type. Only JPEG and PNG images are accepted.';
    } else if (response.status === 422) {
      detail = detail || 'Unable to verify the imaging modality. Please check your image and try again.';
    } else if (response.status === 503) {
      detail = detail || 'The AI inference service is temporarily unavailable. Models are not ready.';
    }

    throw new ApiError(response.status, detail);
  }

  return response.json();
}

export const api = {
  /**
   * Health check endpoint
   */
  async checkHealth(signal?: AbortSignal): Promise<HealthResponse> {
    const url = `${API_BASE_URL}/api/health`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        signal
      });
      return handleResponse<HealthResponse>(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new ApiError(0, 'Unable to connect to NetraDrishti backend service. Ensure server is running.');
    }
  },

  /**
   * Predict OCT retinal scan
   */
  async predictOCT(file: File, signal?: AbortSignal): Promise<OCTPredictionResponse> {
    const url = `${API_BASE_URL}/api/predict/oct`;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        },
        signal
      });
      return handleResponse<OCTPredictionResponse>(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new ApiError(0, 'Failed to complete OCT analysis. Network or server error.');
    }
  },

  /**
   * Predict Fundus retinal photograph
   */
  async predictFundus(file: File, signal?: AbortSignal): Promise<FundusPredictionResponse> {
    const url = `${API_BASE_URL}/api/predict/fundus`;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        },
        signal
      });
      return handleResponse<FundusPredictionResponse>(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new ApiError(0, 'Failed to complete Fundus analysis. Network or server error.');
    }
  },

  /**
   * Generate real Grad-CAM explanation for an OCT retinal scan
   */
  async explainOCT(
    file: File,
    targetClass?: string,
    signal?: AbortSignal
  ): Promise<OCTExplanationResponse> {
    const params = targetClass ? `?target_class=${encodeURIComponent(targetClass)}` : '';
    const url = `${API_BASE_URL}/api/explain/oct${params}`;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        },
        signal
      });
      return handleResponse<OCTExplanationResponse>(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new ApiError(0, 'Failed to generate OCT Grad-CAM explanation.');
    }
  },

  /**
   * Generate real Grad-CAM explanation for a Fundus retinal photograph
   */
  async explainFundus(
    file: File,
    disease?: string,
    signal?: AbortSignal
  ): Promise<FundusExplanationResponse> {
    const params = disease ? `?disease=${encodeURIComponent(disease)}` : '';
    const url = `${API_BASE_URL}/api/explain/fundus${params}`;
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json'
        },
        signal
      });
      return handleResponse<FundusExplanationResponse>(response);
    } catch (err: unknown) {
      if (err instanceof ApiError) throw err;
      if (err instanceof Error && err.name === 'AbortError') throw err;
      throw new ApiError(0, 'Failed to generate Fundus Grad-CAM explanation.');
    }
  }
};
