import React from 'react';
import { Layers, Eye } from 'lucide-react';
import type { Modality } from '../../types/api';

interface ModalitySelectorProps {
  selectedModality: Modality;
  onSelectModality: (modality: Modality) => void;
  disabled?: boolean;
}

export const ModalitySelector: React.FC<ModalitySelectorProps> = ({
  selectedModality,
  onSelectModality,
  disabled = false
}) => {
  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-navy-700/60 pb-5">
        <div>
          <h2 className="text-lg font-bold text-white tracking-tight">
            Analysis Workspace
          </h2>
          <p className="text-xs text-slate-400">
            Select the imaging modality matching your uploaded patient scan.
          </p>
        </div>

        {/* Modality Toggle Tabs */}
        <div className="flex items-center rounded-xl bg-navy-900/90 p-1.5 ring-1 ring-navy-700/80 shadow-inner">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectModality('OCT')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              selectedModality === 'OCT'
                ? 'bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-300 ring-1 ring-cyan-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/40'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Layers className="h-4 w-4 text-cyan-400" />
            <span>OCT Tomography</span>
            <span className="rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] text-cyan-400 font-mono">
              4 Classes
            </span>
          </button>

          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelectModality('Fundus')}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              selectedModality === 'Fundus'
                ? 'bg-gradient-to-r from-teal-500/20 to-cyan-500/20 text-teal-300 ring-1 ring-teal-500/40 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/40'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Eye className="h-4 w-4 text-teal-400" />
            <span>Fundus Photography</span>
            <span className="rounded bg-teal-950 px-1.5 py-0.5 text-[10px] text-teal-400 font-mono">
              8 Diseases
            </span>
          </button>
        </div>
      </div>

      {/* Active Pipeline Status Banner */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-navy-900/50 px-4 py-2.5 text-xs text-slate-300 ring-1 ring-navy-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Active Pipeline:</span>
          {selectedModality === 'OCT' ? (
            <span className="text-cyan-400 font-medium">
              Swin-Tiny Vision Transformer (CNV, DME, DRUSEN, NORMAL)
            </span>
          ) : (
            <span className="text-teal-400 font-medium">
              EfficientNet-B0 + ResNet-50 Ensemble (8 RFMiD Diseases)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span>Endpoint:</span>
          <span className="rounded bg-navy-950 px-2 py-0.5 text-slate-300 border border-navy-800">
            {selectedModality === 'OCT' ? 'POST /api/predict/oct' : 'POST /api/predict/fundus'}
          </span>
        </div>
      </div>
    </div>
  );
};
