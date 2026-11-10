import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { CheckCircle2, Info, Layers, ShieldAlert } from 'lucide-react';
import type { OCTPredictionResponse, OCTExplanationResponse } from '../../types/api';
import { OCT_CONDITIONS } from '../../constants/clinicalInfo';
import { DisclaimerBanner } from '../common/DisclaimerBanner';
import { GradCamSection } from './GradCamSection';

interface OCTResultViewProps {
  result: OCTPredictionResponse;
  previewUrl: string | null;
  explanation: OCTExplanationResponse | null;
  explainLoading: boolean;
  explainError: string | null;
  onSelectTargetClass: (targetClass: string) => void;
  onRetryExplain: () => void;
}

export const OCTResultView: React.FC<OCTResultViewProps> = ({
  result,
  previewUrl,
  explanation,
  explainLoading,
  explainError,
  onSelectTargetClass,
  onRetryExplain,
}) => {
  const predictedInfo = OCT_CONDITIONS[result.predicted_class] || {
    code: result.predicted_class,
    name: result.predicted_class,
    fullName: result.predicted_class,
    category: 'Ophthalmic Condition',
    urgency: 'Moderate',
    shortDescription: 'A finding from the OCT image analysis.',
    clinicalDescription: 'No specific clinical narrative registered for this label.',
    keyFeatures: []
  };

  // Prepare data for Recharts horizontal bar chart
  const chartData = Object.entries(result.scores).map(([className, score]) => ({
    name: className,
    score: Number((score * 100).toFixed(2)),
    rawScore: score,
    isPredicted: className === result.predicted_class
  })).sort((a, b) => b.score - a.score);

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case 'High':
        return 'bg-rose-500/20 text-rose-300 ring-rose-500/40 border-rose-500/30';
      case 'Moderate':
        return 'bg-amber-500/20 text-amber-300 ring-amber-500/40 border-amber-500/30';
      case 'Normal':
        return 'bg-emerald-500/20 text-emerald-300 ring-emerald-500/40 border-emerald-500/30';
      default:
        return 'bg-cyan-500/20 text-cyan-300 ring-cyan-500/40 border-cyan-500/30';
    }
  };

  const getBarColor = (className: string, isPredicted: boolean) => {
    if (isPredicted) {
      if (className === 'NORMAL') return '#10b981'; // emerald
      if (className === 'DRUSEN') return '#f59e0b'; // amber
      return '#d9b77c'; // warm accent
    }
    return '#514a3b'; // dark muted
  };

  return (
    <div className="space-y-6">
      {/* Primary Result Banner */}
      <div className="glass-panel relative overflow-hidden rounded-2xl p-6 sm:p-8">
        <div className="absolute top-0 right-0 h-48 w-48 bg-cyan-500/10 blur-3xl" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-cyan-950 px-2 py-0.5 text-[10px] font-mono text-cyan-400 ring-1 ring-cyan-500/30">
                OCT analysis
              </span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${getUrgencyBadge(predictedInfo.urgency)}`}>
                {predictedInfo.urgency} Urgency Category
              </span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {predictedInfo.fullName}
            </h2>

            <p className="max-w-2xl text-xs sm:text-sm text-slate-300 leading-relaxed">
              {predictedInfo.shortDescription}
            </p>
          </div>

          {/* Highest Softmax Score Metric Card */}
          <div className="flex shrink-0 flex-col items-start md:items-end rounded-xl border border-navy-700 bg-navy-900/90 p-4 min-w-[200px]">
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
              Analysis score
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-3xl font-black font-mono text-cyan-400">
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <span className="mt-1 text-[11px] text-slate-400">
              Highest scoring class: <strong className="text-slate-200">{result.predicted_class}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Probability Distribution Chart + Clinical Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Softmax Probability Distribution Chart */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between pb-4 border-b border-navy-700/60">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                OCT condition scores
              </h3>
              <p className="text-[11px] text-slate-400">
                Compare the scores across four OCT categories.
              </p>
            </div>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 60, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(val) => `${val}%`}
                  stroke="#475569"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="name"
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
                        <div className="rounded-lg border border-navy-700 bg-navy-950 p-3 shadow-xl text-xs">
                          <p className="font-bold text-white">{data.name}</p>
                          <p className="text-cyan-400 font-mono mt-0.5">
                            Confidence: {data.score}%
                          </p>
                          <p className="text-[10px] text-slate-400 mt-1">
                            Raw score: {data.rawScore.toFixed(4)}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="score" radius={[0, 6, 6, 0]} barSize={24}>
                  {chartData.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={getBarColor(entry.name, entry.isPredicted)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-400 border-t border-navy-800 pt-3">
            {chartData.map((item) => (
              <div key={item.name} className="flex items-center justify-between px-2 py-1 rounded bg-navy-900/60">
                <span className={item.isPredicted ? 'font-bold text-cyan-300' : 'text-slate-400'}>
                  {item.name}:
                </span>
                <span className="font-mono text-slate-200">
                  {(item.rawScore * 100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Clinical Context */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 border-b border-navy-700/60">
              <Info className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Clinical Pathology Insights
              </h3>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Pathology Overview
                </h4>
                <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                  {predictedInfo.clinicalDescription}
                </p>
              </div>

              {predictedInfo.keyFeatures.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Key Morphological Biomarkers
                  </h4>
                  <ul className="mt-2 space-y-1.5 text-xs text-slate-400">
                    {predictedInfo.keyFeatures.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-navy-700/80 bg-navy-900/80 p-3 text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300 mb-1">
              <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
              <span>Diagnostic Consideration Note</span>
            </div>
            Scores show how closely the image matches each category. They do not confirm a diagnosis.
          </div>
        </div>
      </div>

      {/* Explainable AI — Grad-CAM */}
      <GradCamSection
        modality="OCT"
        previewUrl={previewUrl}
        octPrediction={result}
        octExplanation={explanation}
        loading={explainLoading}
        error={explainError}
        onSelectOCTClass={onSelectTargetClass}
        onRetry={onRetryExplain}
      />

      {/* Medical Disclaimer Banner */}
      <DisclaimerBanner />
    </div>
  );
};
