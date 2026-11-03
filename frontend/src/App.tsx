import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HeroSection } from './components/landing/HeroSection';
import { ModalityOverview } from './components/landing/ModalityOverview';
import { TechnologyStack } from './components/landing/TechnologyStack';
import { ModalitySelector } from './components/workspace/ModalitySelector';
import { ImageUploader } from './components/workspace/ImageUploader';
import { OCTResultView } from './components/workspace/OCTResultView';
import { FundusResultView } from './components/workspace/FundusResultView';
import type {
  Modality,
  HealthResponse,
  OCTPredictionResponse,
  FundusPredictionResponse,
  FileMetadata
} from './types/api';
import { api, ApiError } from './services/api';
import { AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  // Navigation View State
  const [activeView, setActiveView] = useState<'landing' | 'workspace'>('landing');

  // Modality & File State
  const [selectedModality, setSelectedModality] = useState<Modality>('OCT');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<FileMetadata | null>(null);

  // Analysis Lifecycle State
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [octResult, setOctResult] = useState<OCTPredictionResponse | null>(null);
  const [fundusResult, setFundusResult] = useState<FundusPredictionResponse | null>(null);

  // Health State
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);

  // AbortController Ref
  const abortControllerRef = useRef<AbortController | null>(null);

  // Check Backend Health
  const checkHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const data = await api.checkHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    // Periodic health poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  // Handle File Selection & Extraction of Metadata
  const handleFileSelect = useCallback((file: File | null) => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setErrorMessage(null);
    setOctResult(null);
    setFundusResult(null);

    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setMetadata(null);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    // Compute dimensions
    const img = new Image();
    img.onload = () => {
      setMetadata({
        name: file.name,
        size: file.size,
        type: file.type,
        width: img.naturalWidth,
        height: img.naturalHeight
      });
    };
    img.onerror = () => {
      setMetadata({
        name: file.name,
        size: file.size,
        type: file.type
      });
    };
    img.src = objectUrl;
  }, [previewUrl]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Modality Selection Handler
  const handleSelectModality = (modality: Modality) => {
    if (modality !== selectedModality) {
      setSelectedModality(modality);
      setOctResult(null);
      setFundusResult(null);
      setErrorMessage(null);
    }
  };

  // Launch analysis workspace from landing page
  const handleStartAnalysis = (modality?: Modality) => {
    if (modality) {
      setSelectedModality(modality);
    }
    setActiveView('workspace');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Run Inference Execution
  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select or upload a retinal image first.');
      return;
    }

    if (!health?.models_ready) {
      setErrorMessage('Cannot proceed: backend AI models are currently not loaded or unavailable.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      if (selectedModality === 'OCT') {
        const result = await api.predictOCT(selectedFile, controller.signal);
        setOctResult(result);
        setFundusResult(null);
      } else {
        const result = await api.predictFundus(selectedFile, controller.signal);
        setFundusResult(result);
        setOctResult(null);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        setErrorMessage('Inference was canceled by user.');
      } else if (err instanceof ApiError) {
        setErrorMessage(err.detail);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('An unexpected error occurred during model inference.');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // Cancel Request
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  const isBackendReady = Boolean(health?.models_ready && health?.status === 'healthy');

  return (
    <div className="flex min-h-screen flex-col bg-navy-950 text-slate-100">
      {/* Global Header */}
      <Header
        health={health}
        healthLoading={healthLoading}
        onRefreshHealth={checkHealth}
        activeView={activeView}
        onSelectView={setActiveView}
      />

      <main className="flex-1">
        {activeView === 'landing' ? (
          /* Landing Screen */
          <div>
            <HeroSection onStartAnalysis={handleStartAnalysis} />
            <ModalityOverview onSelectModality={handleStartAnalysis} />
            <TechnologyStack />
          </div>
        ) : (
          /* Analysis Workspace Screen */
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <div className="space-y-8">
              {/* Modality Selector Navigation */}
              <ModalitySelector
                selectedModality={selectedModality}
                onSelectModality={handleSelectModality}
                disabled={isLoading}
              />

              {/* Upload Panel */}
              <ImageUploader
                modality={selectedModality}
                selectedFile={selectedFile}
                previewUrl={previewUrl}
                metadata={metadata}
                isLoading={isLoading}
                onFileSelect={handleFileSelect}
                onAnalyze={handleAnalyze}
                onCancel={handleCancel}
                isBackendReady={isBackendReady}
              />

              {/* Global Error Banner */}
              {errorMessage && (
                <div className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-200">Analysis Halted</p>
                    <p className="text-rose-300/90 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Inference Results Section */}
              {selectedModality === 'OCT' && octResult && (
                <div className="pt-4 border-t border-navy-800">
                  <OCTResultView result={octResult} />
                </div>
              )}

              {selectedModality === 'Fundus' && fundusResult && (
                <div className="pt-4 border-t border-navy-800">
                  <FundusResultView result={fundusResult} />
                </div>
              )}

              {/* Empty state reminder before analysis */}
              {!octResult && !fundusResult && !isLoading && (
                <div className="rounded-2xl border border-dashed border-navy-800/80 bg-navy-900/20 p-12 text-center text-slate-500">
                  <p className="text-sm font-medium text-slate-400">
                    Awaiting Retinal Image Submission
                  </p>
                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                    Upload a verified {selectedModality} image above or use the "Load Demo Sample" button to test the neural classification pipeline.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Global Footer */}
      <Footer />
    </div>
  );
};

export default App;
