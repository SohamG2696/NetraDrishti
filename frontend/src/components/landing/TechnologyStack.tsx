import React from 'react';
import { Cpu, Network, ShieldCheck } from 'lucide-react';

export const TechnologyStack: React.FC = () => {
  return (
    <section className="py-16 border-t border-navy-800/60 bg-navy-950/40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
            Research Architecture
          </h2>
          <p className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Model Specifications & Pipeline Integrity
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm text-slate-400">
            Engineered with deep neural architectures fine-tuned specifically on validated ophthalmic benchmarks.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Swin-Tiny */}
          <div className="glass-card rounded-2xl p-6 border border-navy-700/60 hover:border-cyan-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
                <Network className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Swin-Tiny OCT Backbone</h3>
                <span className="text-[11px] text-cyan-400 font-mono">torchvision.models.swin_t</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              Employs shifted-window self-attention to capture hierarchical spatial representations across cross-sectional retinal layers. Trained with aspect-ratio preserving thumbnailing and zero-padding after ImageNet normalization.
            </p>
            <div className="mt-4 rounded-xl bg-navy-900/90 p-3 text-[11px] font-mono text-slate-400 border border-navy-800">
              <div className="flex justify-between py-0.5">
                <span>Input:</span>
                <span className="text-slate-200">256 × 256 (3-Ch Grayscale)</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Embedding:</span>
                <span className="text-slate-200">768 Dim</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Validation Acc:</span>
                <span className="text-emerald-400">95.02%</span>
              </div>
            </div>
          </div>

          {/* Fundus Ensemble */}
          <div className="glass-card rounded-2xl p-6 border border-navy-700/60 hover:border-teal-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400">
                <Cpu className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Dual-Backbone Fundus Ensemble</h3>
                <span className="text-[11px] text-teal-400 font-mono">EfficientNet-B0 + ResNet-50</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              Blends deep residual inductive biases with compound scaled depthwise convolutions (50/50 weighted combination). Calibrated with individual disease decision thresholds optimized for multi-label F1 performance.
            </p>
            <div className="mt-4 rounded-xl bg-navy-900/90 p-3 text-[11px] font-mono text-slate-400 border border-navy-800">
              <div className="flex justify-between py-0.5">
                <span>Weighting:</span>
                <span className="text-slate-200">0.50 EffNet + 0.50 ResNet</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Diseases:</span>
                <span className="text-slate-200">8 RFMiD Categories</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Inference:</span>
                <span className="text-emerald-400">Calibrated Sigmoid Thresholds</span>
              </div>
            </div>
          </div>

          {/* Secure Backend Pipeline */}
          <div className="glass-card rounded-2xl p-6 border border-navy-700/60 hover:border-blue-500/30 transition-all">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">In-Memory Security</h3>
                <span className="text-[11px] text-blue-400 font-mono">Zero-Persistence FastAPI</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-slate-300">
              Retinal imaging data is decoded strictly within volatile memory via Pillow with decompression bomb bounds (max 25M pixels). Models remain persistently resident on the compute device across requests without disk writes.
            </p>
            <div className="mt-4 rounded-xl bg-navy-900/90 p-3 text-[11px] font-mono text-slate-400 border border-navy-800">
              <div className="flex justify-between py-0.5">
                <span>Disk Persistence:</span>
                <span className="text-emerald-400">None (Pure RAM)</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Size Protection:</span>
                <span className="text-slate-200">10 MB Stream Cutoff</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span>Concurrency:</span>
                <span className="text-slate-200">Threadpool Non-Blocking</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
