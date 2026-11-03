import React, { useState, useRef, useCallback } from 'react';
import { UploadCloud, FileImage, X, AlertCircle, ArrowUpRight, Sparkles, Loader2, StopCircle } from 'lucide-react';
import type { Modality, FileMetadata } from '../../types/api';

interface ImageUploaderProps {
  modality: Modality;
  selectedFile: File | null;
  previewUrl: string | null;
  metadata: FileMetadata | null;
  isLoading: boolean;
  onFileSelect: (file: File | null) => void;
  onAnalyze: () => void;
  onCancel: () => void;
  isBackendReady: boolean;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  modality,
  selectedFile,
  previewUrl,
  metadata,
  isLoading,
  onFileSelect,
  onAnalyze,
  onCancel,
  isBackendReady
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = useCallback((file: File) => {
    setErrorMessage(null);

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type.toLowerCase())) {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'jpg' && ext !== 'jpeg' && ext !== 'png') {
        setErrorMessage('Unsupported file format. Please upload a JPEG or PNG image.');
        return;
      }
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage(`File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds the 10 MB limit.`);
      return;
    }

    if (file.size === 0) {
      setErrorMessage('The selected file is empty.');
      return;
    }

    onFileSelect(file);
  }, [onFileSelect]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleClear = () => {
    setErrorMessage(null);
    onFileSelect(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Helper to load bundled sample demo images
  const handleLoadSample = async () => {
    try {
      setErrorMessage(null);
      const samplePath = modality === 'OCT' 
        ? '/samples/sample_oct_cnv.jpeg' 
        : '/samples/sample_fundus_dr.png';
      
      const fileName = modality === 'OCT' ? 'sample_oct_cnv.jpeg' : 'sample_fundus_dr.png';
      const response = await fetch(samplePath);
      if (!response.ok) {
        throw new Error('Failed to load sample image file.');
      }
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
      validateAndSetFile(file);
    } catch {
      setErrorMessage('Sample demo image is currently unavailable.');
    }
  };

  return (
    <div className="glass-panel rounded-2xl p-6 sm:p-7">
      <div className="flex items-center justify-between pb-4">
        <div className="flex items-center gap-2">
          <FileImage className={`h-5 w-5 ${modality === 'OCT' ? 'text-cyan-400' : 'text-teal-400'}`} />
          <h3 className="text-sm font-bold tracking-tight text-white uppercase">
            Upload Retinal {modality} Scan
          </h3>
        </div>

        {/* Demo Preset Button */}
        {!selectedFile && (
          <button
            type="button"
            onClick={handleLoadSample}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-lg border border-navy-700 bg-navy-900/80 px-2.5 py-1 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
          >
            <Sparkles className="h-3 w-3 text-cyan-400" />
            <span>Load Demo Sample</span>
          </button>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />

      {/* Upload Drop Zone / Preview Container */}
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
            isDragOver
              ? 'border-cyan-400 bg-cyan-950/20 shadow-glow-cyan'
              : 'border-navy-700/80 bg-navy-900/40 hover:border-navy-600 hover:bg-navy-900/70'
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-navy-800/80 text-cyan-400 ring-1 ring-navy-700">
            <UploadCloud className="h-6 w-6" />
          </div>

          <div className="mt-4 space-y-1">
            <p className="text-sm font-medium text-white">
              Drag and drop your <span className={modality === 'OCT' ? 'text-cyan-300 font-semibold' : 'text-teal-300 font-semibold'}>{modality} scan</span> here
            </p>
            <p className="text-xs text-slate-400">
              or <span className="text-cyan-400 underline underline-offset-2">browse files</span> from your local workstation
            </p>
          </div>

          <div className="mt-4 flex items-center gap-2 text-[11px] text-slate-500">
            <span>Accepted: JPEG, PNG</span>
            <span>•</span>
            <span>Maximum size: 10 MB</span>
          </div>
        </div>
      ) : (
        /* Image Preview Box */
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-navy-700 bg-navy-950/80 p-3">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* Thumbnail */}
              <div className="relative h-44 w-full sm:w-44 shrink-0 overflow-hidden rounded-lg border border-navy-800 bg-navy-900">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Retinal scan preview"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-slate-600">
                    <FileImage className="h-8 w-8" />
                  </div>
                )}
              </div>

              {/* File Info */}
              <div className="flex-1 space-y-2 text-left w-full">
                <div className="flex items-start justify-between">
                  <div className="max-w-[240px] truncate font-medium text-white text-sm" title={selectedFile.name}>
                    {selectedFile.name}
                  </div>
                  {!isLoading && (
                    <button
                      type="button"
                      onClick={handleClear}
                      className="rounded-lg p-1 text-slate-400 hover:bg-navy-800 hover:text-white transition-colors"
                      title="Remove file"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <div className="rounded bg-navy-900/80 px-2.5 py-1.5 border border-navy-800">
                    <span className="text-slate-500 block text-[10px]">FILE SIZE</span>
                    <span className="font-mono text-slate-200">
                      {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>

                  <div className="rounded bg-navy-900/80 px-2.5 py-1.5 border border-navy-800">
                    <span className="text-slate-500 block text-[10px]">DIMENSIONS</span>
                    <span className="font-mono text-slate-200">
                      {metadata?.width && metadata?.height ? `${metadata.width} × ${metadata.height}` : 'Calculating...'}
                    </span>
                  </div>
                </div>

                <div className="rounded bg-navy-900/80 px-2.5 py-1.5 border border-navy-800 text-xs">
                  <span className="text-slate-500 block text-[10px]">SELECTED MODALITY</span>
                  <span className={`font-semibold ${modality === 'OCT' ? 'text-cyan-400' : 'text-teal-400'}`}>
                    {modality === 'OCT' ? 'Optical Coherence Tomography (OCT)' : 'Digital Color Fundus Photography'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error callout if validation failed */}
      {errorMessage && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Backend Offline Warning */}
      {!isBackendReady && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
          <span>NetraDrishti backend service is not ready. Analysis is currently disabled until models are available.</span>
        </div>
      )}

      {/* Action Controls */}
      {selectedFile && (
        <div className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-navy-700/60 pt-4">
          {!isLoading ? (
            <>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-xl border border-navy-700 bg-navy-900 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:border-navy-600 hover:text-white transition-colors"
              >
                Clear
              </button>

              <button
                type="button"
                disabled={!isBackendReady}
                onClick={onAnalyze}
                className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-semibold shadow-lg transition-all ${
                  isBackendReady
                    ? modality === 'OCT'
                      ? 'bg-gradient-to-r from-cyan-500 to-teal-500 text-navy-950 shadow-cyan-500/20 hover:from-cyan-400 hover:to-teal-400'
                      : 'bg-gradient-to-r from-teal-500 to-cyan-500 text-navy-950 shadow-teal-500/20 hover:from-teal-400 hover:to-cyan-400'
                    : 'bg-navy-800 text-slate-500 cursor-not-allowed shadow-none'
                }`}
              >
                <span>Run {modality} Analysis</span>
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2 text-xs text-cyan-300">
                <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
                <span>Running deep neural inference on {modality} image...</span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-colors"
              >
                <StopCircle className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
