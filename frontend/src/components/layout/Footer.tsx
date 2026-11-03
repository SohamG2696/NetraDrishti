import React from 'react';
import { Eye, Shield, Cpu, Activity } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-20 border-t border-navy-700/60 bg-navy-950/90 py-12 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* Brand info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40">
                <Eye className="h-5 w-5" />
              </div>
              <span className="text-base font-bold text-white">Netra<span className="text-cyan-400">Drishti</span></span>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-slate-400">
              An advanced deep learning framework for dual-modality retinal disease detection, combining Vision Transformers for OCT tomography with dual-backbone CNN ensembles for color Fundus photography.
            </p>
            <div className="flex items-center gap-3 pt-2 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Cpu className="h-3.5 w-3.5 text-cyan-400" />
                PyTorch 2.x
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-teal-400" />
                FastAPI High-Throughput
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-blue-400" />
                Zero-Persistence Privacy
              </span>
            </div>
          </div>

          {/* Model Specs */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Model Architectures
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <span className="text-cyan-300 font-medium">OCT:</span> Swin Transformer Tiny (`swin_t`)
              </li>
              <li>
                <span className="text-teal-300 font-medium">Fundus:</span> 50/50 Ensemble
              </li>
              <li className="pl-3 text-[11px] text-slate-500">
                • EfficientNet-B0
              </li>
              <li className="pl-3 text-[11px] text-slate-500">
                • ResNet-50 Deep Residual Net
              </li>
              <li>
                <span className="text-blue-300 font-medium">Calibrated:</span> F1-optimized thresholds
              </li>
            </ul>
          </div>

          {/* Endpoints & Technical */}
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              API Specifications
            </h4>
            <ul className="mt-3 space-y-2 text-xs text-slate-400">
              <li>
                <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer" className="text-cyan-400 hover:underline">
                  Interactive Swagger Docs
                </a>
              </li>
              <li>
                <code className="text-[11px] text-slate-300">POST /api/predict/oct</code>
              </li>
              <li>
                <code className="text-[11px] text-slate-300">POST /api/predict/fundus</code>
              </li>
              <li>
                <code className="text-[11px] text-slate-300">GET /api/health</code>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-navy-800 pt-6 text-center text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} NetraDrishti Ophthalmic AI Platform. For Research and Educational Demonstration Only.
          </p>
        </div>
      </div>
    </footer>
  );
};

