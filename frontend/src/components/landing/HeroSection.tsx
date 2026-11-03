import React from 'react';
import { ArrowRight, Layers, Eye, ShieldCheck, Zap } from 'lucide-react';
import type { Modality } from '../../types/api';

interface HeroSectionProps {
  onStartAnalysis: (modality?: Modality) => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onStartAnalysis }) => {
  return (
    <section className="relative overflow-hidden pt-12 pb-20 lg:pt-16 lg:pb-24">
      {/* Background radial gradient glow */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[450px] w-[700px] rounded-full bg-gradient-to-tr from-cyan-500/10 via-teal-500/10 to-blue-600/5 blur-[120px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        {/* Top pill badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1.5 text-xs font-medium text-cyan-300 backdrop-blur-md mb-6">
          <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
          <span>Dual-Modality AI Ophthalmology Screening</span>
          <span className="text-cyan-500/60">•</span>
          <span className="text-slate-400">OCT + Fundus</span>
        </div>

        {/* Main Heading */}
        <h1 className="mx-auto max-w-4xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          Automated Retinal Pathology Analysis via{' '}
          <span className="bg-gradient-to-r from-cyan-400 via-teal-300 to-blue-400 bg-clip-text text-transparent">
            Deep Neural Ensembles
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base sm:leading-relaxed">
          NetraDrishti combines hierarchical Vision Transformers for cross-sectional Optical Coherence Tomography (OCT) with dual-backbone CNN ensembles for digital Fundus photography, delivering rapid multi-condition retinal triage.
        </p>

        {/* Action CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => onStartAnalysis('OCT')}
            className="group flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-6 py-3.5 text-sm font-semibold text-navy-950 shadow-lg shadow-cyan-500/25 transition-all hover:from-cyan-400 hover:to-teal-400 hover:shadow-cyan-500/40"
          >
            <span>Launch OCT Analysis</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>

          <button
            onClick={() => onStartAnalysis('Fundus')}
            className="flex items-center gap-2 rounded-xl border border-navy-700 bg-navy-900/80 px-6 py-3.5 text-sm font-semibold text-slate-200 backdrop-blur-sm transition-all hover:border-cyan-500/40 hover:bg-navy-850 hover:text-white"
          >
            <Eye className="h-4 w-4 text-cyan-400" />
            <span>Launch Fundus Screening</span>
          </button>
        </div>

        {/* Metric / Feature Highlights Grid */}
        <div className="mt-16 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:gap-6">
          <div className="glass-card rounded-2xl p-5 text-left transition-all hover:border-cyan-500/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 mb-3">
              <Layers className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-white">Swin-Tiny</div>
            <div className="text-xs text-cyan-300 font-medium">OCT Tomography</div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              Classifies CNV, DME, Drusen, and Normal with shifted window attention.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 text-left transition-all hover:border-teal-500/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 mb-3">
              <Eye className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-white">8 Diseases</div>
            <div className="text-xs text-teal-300 font-medium">Fundus Ensemble</div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              EfficientNet-B0 + ResNet-50 50/50 weighted combination for RFMiD conditions.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 text-left transition-all hover:border-blue-500/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 mb-3">
              <Zap className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-white">&lt; 1 Second</div>
            <div className="text-xs text-blue-300 font-medium">Inference Latency</div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              High-throughput in-memory inference without blocking the async event loop.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-5 text-left transition-all hover:border-cyan-500/30">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 mb-3">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="text-xl font-bold text-white">Zero Storage</div>
            <div className="text-xs text-cyan-300 font-medium">Privacy Guaranteed</div>
            <p className="mt-1 text-[11px] text-slate-400 leading-snug">
              Strictly in-memory pixel decoding with decompression-bomb protection.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
