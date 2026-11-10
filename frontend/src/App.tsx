import React, { lazy, Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { Header } from './components/layout/Header';
import { Footer } from './components/layout/Footer';
import { HeroSection } from './components/landing/HeroSection';
import { ModalityOverview } from './components/landing/ModalityOverview';
import { TechnologyStack } from './components/landing/TechnologyStack';
import { ModalitySelector } from './components/workspace/ModalitySelector';
import { ImageUploader } from './components/workspace/ImageUploader';
import { RetinalIllustration } from './components/common/RetinalIllustration';
import { BrandMark } from './components/common/BrandMark';
import { EyeBackdrop } from './components/background/EyeBackdrop';
import type {
  Modality,
  HealthResponse,
  OCTPredictionResponse,
  FundusPredictionResponse,
  FileMetadata
} from './types/api';
import { api, ApiError } from './services/api';
import { AlertCircle, Check, ShieldCheck } from 'lucide-react';

const OCTResultView = lazy(() => import('./components/workspace/OCTResultView').then(module => ({ default: module.OCTResultView })));
const FundusResultView = lazy(() => import('./components/workspace/FundusResultView').then(module => ({ default: module.FundusResultView })));

export const App: React.FC = () => {
  // Navigation View State
  const [activeView, setActiveView] = useState<'landing' | 'workspace'>('landing');
  const [navigationTarget, setNavigationTarget] = useState<string | null>(null);
  const [anatomyChapter, setAnatomyChapter] = useState(0);

  useEffect(() => {
    if (!navigationTarget) return;
    const frame = requestAnimationFrame(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
      if (navigationTarget === 'top') {
        window.scrollTo({ top: 0, behavior });
        document.querySelector<HTMLElement>('main h1')?.focus({ preventScroll: true });
      } else {
        const section = document.getElementById(navigationTarget);
        section?.scrollIntoView({ behavior, block: 'start' });
        const heading = section?.querySelector<HTMLElement>('h2');
        heading?.setAttribute('tabindex', '-1');
        heading?.focus({ preventScroll: true });
      }
      setNavigationTarget(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [activeView, navigationTarget]);

  const handleSelectView = (view: 'landing' | 'workspace') => {
    setActiveView(view);
    setNavigationTarget('top');
  };

  const handleNavigateSection = (section: string) => {
    setActiveView('landing');
    setNavigationTarget(section);
  };

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
  const [healthLoading, setHealthLoading] = useState<boolean>(true);

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
    const initialCheck = window.setTimeout(() => { void checkHealth(); }, 0);
    // Periodic health poll every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => { clearTimeout(initialCheck); clearInterval(interval); };
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
      handleSelectModality(modality);
    }
    handleSelectView('workspace');
  };

  // Run Inference Execution
  const handleAnalyze = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select or upload a retinal image first.');
      return;
    }

    if (!health?.models_ready) {
      setErrorMessage('The analysis service is unavailable. Please try again shortly.');
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
        setErrorMessage('Analysis was canceled by user.');
      } else if (err instanceof ApiError) {
        setErrorMessage(err.detail);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('The analysis could not be completed. Please try again.');
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
    <div className="app-shell flex min-h-screen flex-col text-slate-100">
      <EyeBackdrop workspace={activeView === 'workspace'} chapter={anatomyChapter} />
      {/* Global Header */}
      <Header
        health={health}
        healthLoading={healthLoading}
        onRefreshHealth={checkHealth}
        activeView={activeView}
        onSelectView={handleSelectView}
        onNavigateSection={handleNavigateSection}
      />

      <main id="main-content" className="flex-1" tabIndex={-1}>
        {activeView === 'landing' ? (
          /* Landing Screen */
          <div>
            <HeroSection onStartAnalysis={handleStartAnalysis} onChapterChange={setAnatomyChapter} />
            <ModalityOverview onSelectModality={handleStartAnalysis} />
            <TechnologyStack />
          </div>
        ) : (
          /* Analysis Workspace Screen */
          <div className="workspace-page page-container">
            <div className="workspace-heading">
              <div><p className="eyebrow">THE ANALYSIS WORKSPACE</p><h1 tabIndex={-1}>A closer look at <span className="serif-accent">your scan.</span></h1><p>Choose your imaging type. Upload a scan. Explore the details.</p></div>
              <span className="workspace-step-label">{octResult || fundusResult ? '03 / EXPLORE RESULTS' : isLoading ? '02 / ANALYZING IMAGE' : '01 / PREPARE YOUR IMAGE'}</span>
            </div>
            <div className="space-y-8">
              {/* Modality Selector Navigation */}
              <ModalitySelector
                selectedModality={selectedModality}
                onSelectModality={handleSelectModality}
                disabled={isLoading}
              />

              {/* Upload Panel */}
              <div className="workspace-upload-layout">
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
                <aside className="workspace-guide" aria-label="Image preparation guidance">
                  <p className="eyebrow">A LITTLE CLARITY, BEFORE YOU BEGIN</p>
                  <h3>{selectedModality === 'OCT' ? 'Explore the layers within.' : 'See the retinal surface.'}</h3>
                  <RetinalIllustration variant={selectedModality} />
                  <ul><li><Check size={13} /><span>Choose an image that matches the selected imaging modality.</span></li><li><Check size={13} /><span>Upload a JPEG or PNG, up to 10 MB.</span></li><li><Check size={13} /><span>No image handy? Load a demo sample to explore the workflow.</span></li></ul>
                  <div className="guide-privacy"><ShieldCheck size={14} />Your uploaded scans are not saved.</div>
                </aside>
              </div>

              {/* Global Error Banner */}
              {errorMessage && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
                  <AlertCircle className="h-5 w-5 shrink-0 text-rose-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-rose-200">Analysis Halted</p>
                    <p className="text-rose-300/90 leading-relaxed">{errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Inference Results Section */}
              {selectedModality === 'OCT' && octResult && (
                <div className="result-region pt-4 border-t border-navy-800" aria-live="polite">
                  <Suspense fallback={<p role="status" className="py-8 text-sm text-slate-400">Preparing your OCT results…</p>}><OCTResultView result={octResult} /></Suspense>
                </div>
              )}

              {selectedModality === 'Fundus' && fundusResult && (
                <div className="result-region pt-4 border-t border-navy-800" aria-live="polite">
                  <Suspense fallback={<p role="status" className="py-8 text-sm text-slate-400">Preparing your fundus results…</p>}><FundusResultView result={fundusResult} /></Suspense>
                </div>
              )}

              {/* Empty state reminder before analysis */}
              {!octResult && !fundusResult && !isLoading && (
                <div className="workspace-empty">
                  <BrandMark />
                  <h3>Your next insight starts with an image.</h3>
                  <p>Upload a {selectedModality} scan or load a demo sample above. Your analysis and condition scores will appear here.</p>
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
