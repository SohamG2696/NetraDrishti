import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { CLINICAL_DISCLAIMER } from '../../constants/clinicalInfo';

interface DisclaimerBannerProps {
  compact?: boolean;
}

export const DisclaimerBanner: React.FC<DisclaimerBannerProps> = ({ compact = false }) => {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
        <p className="line-clamp-1">{CLINICAL_DISCLAIMER}</p>
      </div>
    );
  }

  return (
    <aside aria-label="Medical Disclaimer" className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-navy-900/40 p-4 backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-amber-500/20 p-2 text-amber-400">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h4 className="text-sm font-semibold tracking-wide text-amber-300 uppercase">
            Research & Educational Purpose Only
          </h4>
          <p className="mt-1 text-xs leading-relaxed text-amber-200/90">
            {CLINICAL_DISCLAIMER} Softmax probabilities and Sigmoid scores quantify mathematical confidence distributions and do not constitute clinically calibrated medical certainty.
          </p>
        </div>
      </div>
    </aside>
  );
};

