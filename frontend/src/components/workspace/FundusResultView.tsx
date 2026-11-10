import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CheckCircle2, AlertCircle, Eye, Info } from 'lucide-react';
import type { FundusPredictionResponse, FundusExplanationResponse } from '../../types/api';
import { FUNDUS_DISEASES } from '../../constants/clinicalInfo';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { GradCamSection } from './GradCamSection';

interface FundusResultViewProps {
  result: FundusPredictionResponse;
  previewUrl: string | null;
  explanation: FundusExplanationResponse | null;
  explainLoading: boolean;
  explainError: string | null;
  onSelectDiseaseForExplain: (diseaseCode: string) => void;
  onRetryExplain: () => void;
}

export const FundusResultView: React.FC<FundusResultViewProps> = ({
  result,
  previewUrl,
  explanation,
  explainLoading,
  explainError,
  onSelectDiseaseForExplain,
  onRetryExplain,
}) => {
  const [selectedDisease, setSelectedDisease] = useState<string | null>(null);

  // Array of 8 disease predictions
  const diseasesList = Object.entries(result.predictions).map(([code, data]) => {
    const info = FUNDUS_DISEASES[code] || {
      code,
      name: code,
      fullName: code,
      category: 'General Retinal',
      urgency: 'Moderate' as const,
      shortDescription: 'Retinal manifestation evaluated by the ensemble.',
      clinicalDescription: 'No specific clinical description available.',
      keyFeatures: []
    };

    return {
      code,
      name: info.name,
      fullName: info.fullName,
      score: data.score,
      threshold: data.threshold,
      detected: data.detected,
      percentage: Number((data.score * 100).toFixed(1)),
      thresholdPercentage: Number((data.threshold * 100).toFixed(1)),
      info
    };
  });

  const detectedCount = diseasesList.filter(d => d.detected).length;

  // Prepare chart data sorted by score
  const chartData = [...diseasesList].sort((a, b) => b.score - a.score);

  const activeDiseaseInfo = selectedDisease
    ? diseasesList.find(d => d.code === selectedDisease)?.info || null
    : null;

  return (
    <div className="space-y-6">
      {/* Primary Summary Banner */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="absolute top-0 right-0 h-48 w-48 bg-teal-500/10 blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-teal-950 px-2 py-0.5 text-[10px] font-mono text-teal-400 ring-1 ring-teal-500/30">
                Fundus analysis
              </span>
              <span className="rounded-full bg-navy-800 px-2.5 py-0.5 text-xs font-semibold text-slate-300 ring-1 ring-navy-700">
                8 Retinal Conditions Evaluated
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Color Fundus Multi-Disease Screening
            </h2>

            <p className="max-w-2xl text-xs sm:text-sm text-slate-300 leading-relaxed">
              Explore the findings for eight retinal conditions.
            </p>
          </div>

          {/* Detections Summary Card */}
          <div className="flex shrink-0 flex-col items-start md:items-end rounded-xl border border-navy-700 bg-navy-900/90 p-4 min-w-[200px]">
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              Positive Screenings
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className={`text-3xl font-black font-mono ${detectedCount > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {detectedCount}
              </span>
              <span className="text-xs text-slate-400">/ 8 Detected</span>
            </div>
            <span className="mt-1 text-[11px] text-slate-400">
              {detectedCount > 0 ? 'Thresholds met or exceeded' : 'No conditions exceeded threshold'}
            </span>
          </div>
        </div>
      </div>

      {/* Grid: 8 Disease Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {diseasesList.map((disease) => {
          const isDetected = disease.detected;
          const isSelected = selectedDisease === disease.code;

          return (
            <div
              key={disease.code}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Explore ${disease.fullName} clinical context`}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedDisease(isSelected ? null : disease.code); } }}
              onClick={() => setSelectedDisease(isSelected ? null : disease.code)}
              className={`glass-card cursor-pointer rounded-2xl p-5 transition-all ${
                isSelected
                  ? 'border-cyan-400 bg-navy-850 ring-1 ring-cyan-400/50 shadow-glow-cyan'
                  : isDetected
                  ? 'border-amber-500/40 bg-navy-900/80 hover:border-amber-400/60'
                  : 'border-navy-700/60 bg-navy-900/40 hover:border-navy-600'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono font-bold text-white bg-navy-800 px-1.5 py-0.5 rounded border border-navy-700">
                      {disease.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-200 truncate max-w-[130px]" title={disease.name}>
                      {disease.name}
                    </span>
                  </div>
                </div>

                {/* Detected / Negative Status Badge */}
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    isDetected
                      ? 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40'
                      : 'bg-slate-800/80 text-slate-400 ring-1 ring-slate-700'
                  }`}
                >
                  {isDetected ? (
                    <>
                      <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                      <span>Detected</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                      <span>Negative</span>
                    </>
                  )}
                </span>
              </div>

              {/* Progress bar comparing score to threshold */}
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-400 text-[11px]">Score:</span>
                  <span className={isDetected ? 'font-bold text-amber-300' : 'text-slate-300'}>
                    {disease.score.toFixed(4)}
                  </span>
                </div>

                <div className="relative h-2 w-full rounded-full bg-navy-950 overflow-hidden border border-navy-800">
                  {/* Score bar */}
                  <div
                    className={`h-full rounded-full transition-all ${
                      isDetected ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-cyan-600/70'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, disease.percentage))}%` }}
                  />
                  {/* Threshold mark */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white/90 z-10"
                    style={{ left: `${disease.thresholdPercentage}%` }}
                    title={`Threshold: ${disease.threshold}`}
                  />
                </div>

                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>0.0</span>
                  <span className="text-slate-400 font-mono">Cutoff: {disease.threshold.toFixed(4)}</span>
                  <span>1.0</span>
                </div>
              </div>

              <p className="mt-3 text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                {disease.info.shortDescription}
              </p>
            </div>
          );
        })}
      </div>

      {/* Disease Detail Drawer / Modal if user clicks a card */}
      {activeDiseaseInfo && (
        <div className="glass-panel rounded-2xl p-5 border border-cyan-500/40 bg-navy-900/90 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-navy-800">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">
                Clinical Context: {activeDiseaseInfo.fullName} ({activeDiseaseInfo.code})
              </h4>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onSelectDiseaseForExplain(activeDiseaseInfo.code)}
                className="rounded-lg border border-[#d9b77c]/40 bg-[#d9b77c]/10 px-2.5 py-1 text-[11px] font-semibold text-[#ebd5ad] hover:bg-[#d9b77c]/20"
              >
                Explain {activeDiseaseInfo.code} via Grad-CAM
              </button>
              <button
                onClick={() => setSelectedDisease(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <div>
              <span className="font-semibold text-slate-200 block mb-1">Pathology Definition:</span>
              <p className="leading-relaxed text-slate-300">{activeDiseaseInfo.clinicalDescription}</p>
            </div>
            <div>
              <span className="font-semibold text-slate-200 block mb-1">Characteristic Fundus Signs:</span>
              <ul className="space-y-1">
                {activeDiseaseInfo.keyFeatures.map((kf, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-slate-400">
                    <CheckCircle2 className="h-3 w-3 text-cyan-400 shrink-0" />
                    <span>{kf}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Full-width Comparative Chart */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-navy-700/60">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Fundus condition scores
            </h3>
            <p className="text-[11px] text-slate-400">
              Orange highlights show scores above the screening threshold.
            </p>
          </div>
          <Eye className="h-4 w-4 text-teal-400" />
        </div>

        <div className="mt-6 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 60, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(val) => val.toFixed(2)}
                stroke="#475569"
                fontSize={11}
              />
              <YAxis
                type="category"
                dataKey="code"
                stroke="#cbd5e1"
                fontSize={12}
                fontWeight={600}
              />
              <Tooltip
                  cursor={{ fill: 'rgba(217, 183, 124, 0.06)' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border border-navy-700 bg-navy-950 p-3 shadow-xl text-xs space-y-1">
                        <p className="font-bold text-white">{data.fullName} ({data.code})</p>
                        <p className="font-mono text-cyan-300">
                          Score: {data.score.toFixed(4)}
                        </p>
                        <p className="font-mono text-slate-400">
                          Threshold: {data.threshold.toFixed(4)}
                        </p>
                        <p className={`font-semibold ${data.detected ? 'text-amber-400' : 'text-emerald-400'}`}>
                          Status: {data.detected ? 'Detected (Above Cutoff)' : 'Negative (Below Cutoff)'}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={20}>
                {chartData.map((entry) => (
                  <Cell
                    key={`cell-${entry.code}`}
                    fill={entry.detected ? '#f59e0b' : '#9e7e49'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Explainable AI — Grad-CAM */}
      <GradCamSection
        modality="Fundus"
        previewUrl={previewUrl}
        fundusPrediction={result}
        fundusExplanation={explanation}
        loading={explainLoading}
        error={explainError}
        onSelectFundusDisease={onSelectDiseaseForExplain}
        onRetry={onRetryExplain}
      />

      {/* Disclaimer Banner */}
      <DisclaimerBanner />
    </div>
  );
};
