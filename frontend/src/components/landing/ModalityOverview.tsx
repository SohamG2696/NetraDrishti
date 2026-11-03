import React from 'react';
import { Layers, Eye, ArrowRight, CheckCircle2 } from 'lucide-react';
import type { Modality } from '../../types/api';

interface ModalityOverviewProps {
  onSelectModality: (modality: Modality) => void;
}

export const ModalityOverview: React.FC<ModalityOverviewProps> = ({ onSelectModality }) => {
  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Dual Imaging Modalities
          </h2>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Choose the Clinical Imaging Pathway
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm text-slate-400">
            Select between high-resolution cross-sectional optical tomograms or full-field color fundus photography.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* OCT Card */}
          <div className="glass-panel group relative flex flex-col justify-between overflow-hidden rounded-2xl p-6 transition-all hover:border-cyan-500/50 hover:shadow-glow-cyan sm:p-8">
            <div className="absolute top-0 right-0 h-40 w-40 bg-cyan-500/5 blur-3xl group-hover:bg-cyan-500/10 transition-colors" />

            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 ring-1 ring-cyan-500/30">
                  <Layers className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-950/60 px-3 py-1 text-[11px] font-semibold text-cyan-300">
                  Swin-Tiny Vision Transformer
                </span>
              </div>

              <h3 className="mt-6 text-xl font-bold text-white">
                Optical Coherence Tomography (OCT)
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Non-invasive interferometric optical imaging that provides micrometer-resolution cross-sectional visualization of neuroretinal stratification, RPE elevation, and fluid pooling.
              </p>

              <div className="mt-6 space-y-2 border-t border-navy-700/60 pt-4">
                <div className="text-xs font-semibold text-slate-200">Detectable Conditions (4 Classes):</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span>CNV (Wet AMD)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span>DME (Macular Edema)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span>DRUSEN (Dry AMD)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                    <span>NORMAL (Healthy)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                onClick={() => onSelectModality('OCT')}
                className="group/btn flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 px-4 py-3 text-xs font-semibold text-navy-950 transition-all hover:from-cyan-400 hover:to-teal-400 shadow-md shadow-cyan-500/20"
              >
                <span>Enter OCT Analysis Mode</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </button>
            </div>
          </div>

          {/* Fundus Card */}
          <div className="glass-panel group relative flex flex-col justify-between overflow-hidden rounded-2xl p-6 transition-all hover:border-teal-500/50 hover:shadow-glow-teal sm:p-8">
            <div className="absolute top-0 right-0 h-40 w-40 bg-teal-500/5 blur-3xl group-hover:bg-teal-500/10 transition-colors" />

            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/30">
                  <Eye className="h-6 w-6" />
                </div>
                <span className="rounded-full border border-teal-500/30 bg-teal-950/60 px-3 py-1 text-[11px] font-semibold text-teal-300">
                  EfficientNet + ResNet-50 Ensemble
                </span>
              </div>

              <h3 className="mt-6 text-xl font-bold text-white">
                Digital Color Fundus Photography
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">
                Full-field color ophthalmoscopic photography documenting the neuroretinal rim, optic disc cup, vascular branching, macular lutea, and peripheral retinal pigment distribution.
              </p>

              <div className="mt-6 space-y-2 border-t border-navy-700/60 pt-4">
                <div className="text-xs font-semibold text-slate-200">Detectable Conditions (8 Categories):</div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Diabetic Retinopathy (DR)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Media Haze (MH)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Optic Disc Cupping (ODC)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Tessellated Fundus (TSLN)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Drusen (DN)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Pathological Myopia (MYA)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Macular Degeneration (ARMD)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-teal-400 shrink-0" />
                    <span>Vein Occlusion (BRVO)</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-4">
              <button
                onClick={() => onSelectModality('Fundus')}
                className="group/btn flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-3 text-xs font-semibold text-navy-950 transition-all hover:from-teal-400 hover:to-cyan-400 shadow-md shadow-teal-500/20"
              >
                <span>Enter Fundus Screening Mode</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
