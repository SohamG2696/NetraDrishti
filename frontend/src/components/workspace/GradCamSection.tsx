import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Download,
  SlidersHorizontal,
  Loader2,
  AlertCircle,
  RefreshCw,
  Info,
  ShieldAlert,
  Eye,
  Layers
} from 'lucide-react';
import type {
  OCTPredictionResponse,
  FundusPredictionResponse,
  OCTExplanationResponse,
  FundusExplanationResponse,
} from '../../types/api';

type FundusViewMode = 'combined' | 'efficientnet' | 'resnet';

interface GradCamSectionProps {
  modality: 'OCT' | 'Fundus';
  previewUrl: string | null;
  octPrediction?: OCTPredictionResponse | null;
  fundusPrediction?: FundusPredictionResponse | null;
  octExplanation?: OCTExplanationResponse | null;
  fundusExplanation?: FundusExplanationResponse | null;
  loading: boolean;
  error: string | null;
  onSelectOCTClass?: (targetClass: string) => void;
  onSelectFundusDisease?: (diseaseCode: string) => void;
  onRetry?: () => void;
}

export const GradCamSection: React.FC<GradCamSectionProps> = ({
  modality,
  previewUrl,
  octPrediction,
  fundusPrediction,
  octExplanation,
  fundusExplanation,
  loading,
  error,
  onSelectOCTClass,
  onSelectFundusDisease,
  onRetry,
}) => {
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.45);
  const [fundusViewMode, setFundusViewMode] = useState<FundusViewMode>('combined');
  const [isDownloading, setIsDownloading] = useState<boolean>(false);

  const activeHeatmapUrl = useMemo(() => {
    if (modality === 'OCT') {
      return octExplanation?.heatmap || null;
    }
    if (!fundusExplanation) return null;
    if (fundusViewMode === 'efficientnet') return fundusExplanation.efficientnet_heatmap;
    if (fundusViewMode === 'resnet') return fundusExplanation.resnet_heatmap;
    return fundusExplanation.combined_heatmap;
  }, [modality, octExplanation, fundusExplanation, fundusViewMode]);

  const activeTargetLabel = modality === 'OCT'
    ? octExplanation?.selected_class || octPrediction?.predicted_class || ''
    : fundusExplanation?.selected_disease || '';

  const activeTargetScore = modality === 'OCT'
    ? octExplanation?.selected_score ?? octPrediction?.confidence ?? 0
    : fundusExplanation?.selected_score ?? 0;

  const handleDownloadOverlay = async () => {
    if (!previewUrl || !activeHeatmapUrl) return;
    setIsDownloading(true);
    try {
      const loadImg = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const im = new Image();
          im.crossOrigin = 'anonymous';
          im.onload = () => resolve(im);
          im.onerror = reject;
          im.src = src;
        });

      const [baseImg, heatImg] = await Promise.all([
        loadImg(previewUrl),
        loadImg(activeHeatmapUrl),
      ]);

      const canvas = document.createElement('canvas');
      canvas.width = heatImg.naturalWidth || baseImg.naturalWidth;
      canvas.height = heatImg.naturalHeight || baseImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = overlayOpacity;
      ctx.drawImage(heatImg, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;

      const link = document.createElement('a');
      const modeTag = modality === 'Fundus' ? `-${fundusViewMode}` : '';
      link.download = `netradrishti-${modality.toLowerCase()}-${activeTargetLabel.toLowerCase()}${modeTag}-gradcam.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {
      // Fallback: download server-generated overlay if available
      const fallbackUrl =
        modality === 'OCT' ? octExplanation?.overlay : fundusExplanation?.combined_overlay;
      if (fallbackUrl) {
        const link = document.createElement('a');
        link.download = `netradrishti-${modality.toLowerCase()}-gradcam.png`;
        link.href = fallbackUrl;
        link.click();
      }
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section
      aria-labelledby="gradcam-heading"
      className="glass-panel relative overflow-hidden rounded-2xl p-6 sm:p-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#d9b77c]" />
            <span className="text-[10px] font-mono uppercase tracking-[0.16em] text-[#d9b77c]">
              Gradient-Weighted Attribution
            </span>
          </div>
          <h3 id="gradcam-heading" className="mt-1 text-xl sm:text-2xl font-bold text-white tracking-tight">
            Explainable AI — Grad-CAM
          </h3>
          <p className="mt-1 text-xs text-slate-400 max-w-2xl">
            Visualizes spatial regions in the uploaded {modality} image that positively influenced the neural network&apos;s output score for the selected target.
          </p>
        </div>

        {/* Download Button */}
        <button
          type="button"
          disabled={!activeHeatmapUrl || loading || isDownloading}
          onClick={handleDownloadOverlay}
          className={`flex items-center gap-2 self-start md:self-auto rounded-xl border px-4 py-2 text-xs font-semibold transition-all ${
            activeHeatmapUrl && !loading
              ? 'border-[#d9b77c]/50 bg-[#d9b77c]/10 text-[#ebd5ad] hover:bg-[#d9b77c]/20'
              : 'border-navy-700 bg-navy-900/50 text-slate-500 cursor-not-allowed'
          }`}
        >
          <Download className="h-3.5 w-3.5" />
          <span>{isDownloading ? 'Exporting...' : 'Download Overlay PNG'}</span>
        </button>
      </div>

      {/* Target Class / Disease Selector Bar */}
      <div className="mt-5 space-y-4">
        {modality === 'OCT' && octPrediction && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-[#d9b77c]" />
                Select OCT Target Class
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Active target: <strong className="text-white">{activeTargetLabel}</strong> ({(activeTargetScore * 100).toFixed(2)}%)
              </span>
            </div>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Select OCT class for Grad-CAM">
              {Object.entries(octPrediction.scores).map(([cls, score]) => {
                const isSelected = (octExplanation?.selected_class || octPrediction.predicted_class) === cls;
                const isPredicted = octPrediction.predicted_class === cls;
                return (
                  <button
                    key={cls}
                    type="button"
                    disabled={loading}
                    onClick={() => onSelectOCTClass?.(cls)}
                    aria-pressed={isSelected}
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-medium transition-all ${
                      isSelected
                        ? 'border-[#d9b77c] bg-[#d9b77c]/15 text-white shadow-sm'
                        : 'border-navy-700/80 bg-navy-900/60 text-slate-300 hover:border-navy-600 hover:text-white'
                    } ${loading ? 'opacity-60 cursor-wait' : ''}`}
                  >
                    <span className="font-mono font-bold">{cls}</span>
                    <span className="text-[11px] font-mono text-slate-400">{(score * 100).toFixed(1)}%</span>
                    {isPredicted && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-300">
                        Top
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {modality === 'Fundus' && fundusPrediction && (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Eye className="h-3.5 w-3.5 text-[#d9b77c]" />
                  Select Fundus Disease Target (Detected or Below Threshold)
                </span>
                {fundusExplanation && (
                  <div className="flex items-center gap-2 text-[11px] font-mono text-slate-300">
                    <span>
                      Target: <strong className="text-white">{fundusExplanation.selected_disease}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Score: <strong className="text-[#d9b77c]">{fundusExplanation.selected_score.toFixed(4)}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Cutoff: <strong className="text-slate-300">{fundusExplanation.selected_threshold.toFixed(4)}</strong>
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        fundusExplanation.selected_detected
                          ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                          : 'bg-slate-800 text-slate-300 ring-1 ring-slate-700'
                      }`}
                    >
                      {fundusExplanation.selected_detected ? 'Detected' : 'Below Threshold'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2" role="group" aria-label="Select Fundus disease for Grad-CAM">
                {Object.entries(fundusPrediction.predictions).map(([code, data]) => {
                  const isSelected = fundusExplanation?.selected_disease === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      disabled={loading}
                      onClick={() => onSelectFundusDisease?.(code)}
                      aria-pressed={isSelected}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition-all ${
                        isSelected
                          ? 'border-[#d9b77c] bg-[#d9b77c]/15 text-white'
                          : 'border-navy-700/80 bg-navy-900/60 text-slate-300 hover:border-navy-600 hover:text-white'
                      } ${loading ? 'opacity-60 cursor-wait' : ''}`}
                    >
                      <span className="font-mono font-bold">{code}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {data.score.toFixed(3)}
                      </span>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          data.detected ? 'bg-amber-400' : 'bg-slate-600'
                        }`}
                        title={data.detected ? 'Detected above threshold' : 'Below threshold'}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Ensemble Backbone View Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-navy-800 bg-navy-900/60 px-4 py-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Explanation View Mode
              </span>
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Select Fundus heatmap model view">
                {([
                  { id: 'combined', label: 'Combined Ensemble (50/50)' },
                  { id: 'efficientnet', label: 'EfficientNet-B0' },
                  { id: 'resnet', label: 'ResNet-50' },
                ] as const).map((mode) => (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => setFundusViewMode(mode.id)}
                    aria-pressed={fundusViewMode === mode.id}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-all ${
                      fundusViewMode === mode.id
                        ? 'bg-[#d9b77c] text-[#111009] font-semibold'
                        : 'bg-navy-950/70 text-slate-300 hover:text-white'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading / Error / Visualization Area */}
      <div className="mt-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-navy-800 bg-navy-950/60 py-16 text-center">
            <Loader2 className="h-7 w-7 animate-spin text-[#d9b77c]" />
            <p className="mt-3 text-xs font-medium text-slate-300">
              Computing gradient-based spatial attribution maps...
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              Running forward & backward passes on {modality === 'OCT' ? 'Swin-Tiny' : 'EfficientNet-B0 + ResNet-50'}.
            </p>
          </div>
        ) : error ? (
          <div role="alert" className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-200">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
              <div>
                <p className="font-semibold">Grad-CAM Attribution Unavailable</p>
                <p className="mt-0.5 text-rose-300/90">{error}</p>
              </div>
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="flex items-center gap-1.5 self-start sm:self-auto rounded-lg border border-rose-400/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-500/30"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Retry</span>
              </button>
            )}
          </div>
        ) : activeHeatmapUrl && previewUrl ? (
          <div className="space-y-5">
            {/* Opacity Control Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-navy-800 bg-navy-900/50 px-4 py-3">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <SlidersHorizontal className="h-4 w-4 text-[#d9b77c]" />
                <span className="font-medium">Interactive Overlay Opacity</span>
              </div>
              <div className="flex items-center gap-3 flex-1 max-w-xs">
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(overlayOpacity * 100)}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value) / 100)}
                  aria-label="Overlay heatmap opacity percentage"
                  className="w-full accent-[#d9b77c] cursor-pointer"
                />
                <span className="w-10 text-right font-mono text-xs text-[#d9b77c]">
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
            </div>

            {/* 3-Panel Visual Comparison */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* 1. Original Retinal Image */}
              <div className="rounded-xl border border-navy-800 bg-black/70 p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-slate-400">
                  <span>01 / ORIGINAL {modality.toUpperCase()}</span>
                  <span>TISSUE REFERENCE</span>
                </div>
                <div className="relative flex flex-1 min-h-[220px] items-center justify-center overflow-hidden rounded-lg bg-black">
                  <img
                    src={previewUrl}
                    alt={`Original uploaded ${modality} scan`}
                    className="max-h-[260px] w-full object-contain"
                  />
                </div>
              </div>

              {/* 2. Pure Grad-CAM Heatmap */}
              <div className="rounded-xl border border-navy-800 bg-black/70 p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-slate-400">
                  <span>02 / GRAD-CAM MAP</span>
                  <span className="text-[#d9b77c]">
                    {modality === 'Fundus' ? fundusViewMode.toUpperCase() : activeTargetLabel}
                  </span>
                </div>
                <div className="relative flex flex-1 min-h-[220px] items-center justify-center overflow-hidden rounded-lg bg-black">
                  <img
                    src={activeHeatmapUrl}
                    alt={`Grad-CAM heatmap for ${activeTargetLabel}`}
                    className="max-h-[260px] w-full object-contain"
                  />
                </div>
              </div>

              {/* 3. Live Interactive Overlay */}
              <div className="rounded-xl border border-[#d9b77c]/30 bg-black/70 p-3 flex flex-col">
                <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-slate-300">
                  <span>03 / INTERACTIVE OVERLAY</span>
                  <span className="text-[#d9b77c]">{Math.round(overlayOpacity * 100)}% BLEND</span>
                </div>
                <div className="relative flex flex-1 min-h-[220px] items-center justify-center overflow-hidden rounded-lg bg-black">
                  <div className="relative inline-flex items-center justify-center max-h-[260px] w-full">
                    <img
                      src={previewUrl}
                      alt={`Base ${modality} image for overlay`}
                      className="max-h-[260px] w-full object-contain"
                    />
                    <img
                      src={activeHeatmapUrl}
                      alt={`Overlay heatmap for ${activeTargetLabel}`}
                      style={{ opacity: overlayOpacity }}
                      className="pointer-events-none absolute inset-0 h-full w-full object-contain transition-opacity duration-75"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Methodological Notes & Adjacent Educational Disclaimer */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pt-2">
              <div className="rounded-xl border border-navy-800 bg-navy-900/60 p-4 text-xs text-slate-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-white">
                  <Info className="h-3.5 w-3.5 text-[#d9b77c]" />
                  <span>How to Read This Attribution Map</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-400">
                  Warm regions (red/yellow) correspond to image features that contributed most strongly to the model&apos;s output score for <strong className="text-slate-200">{activeTargetLabel}</strong>; cool blue regions had minimal positive influence.
                </p>
                {modality === 'OCT' ? (
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Computed from Swin-Tiny&apos;s final spatial block (<code className="text-slate-300">features.7.1</code>) before pooling, with artificial padding masked out so attribution aligns strictly with retinal tissue.
                  </p>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-400">
                    Individual EfficientNet-B0 and ResNet-50 Grad-CAMs are computed from each network&apos;s disease probability gradient. The Combined Ensemble map is a 50/50 weighted visualization of those normalized individual maps, not a direct single-graph ensemble gradient.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200/90 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                  <span>Interpretability Limitations</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Grad-CAM highlights coarse low-resolution spatial regions (8×8 for Swin-Tiny OCT; 10×10 for Fundus CNNs) upsampled to image scale. Highlighted areas are algorithmic feature attributions for research and educational use only — they do not represent clinically verified lesion boundaries or medical diagnoses.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-navy-800 p-6 text-center text-xs text-slate-400">
            Select a target class or disease above to view real gradient-based attribution.
          </div>
        )}
      </div>
    </section>
  );
};

