import React from 'react';
import { Eye, Activity, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
import type { HealthResponse } from '../../types/api';

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  onRefreshHealth: () => void;
  activeView: 'landing' | 'workspace';
  onSelectView: (view: 'landing' | 'workspace') => void;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  healthLoading,
  onRefreshHealth,
  activeView,
  onSelectView
}) => {
  const isHealthy = health?.models_ready && health?.status === 'healthy';

  return (
    <header className="sticky top-0 z-50 border-b border-navy-700/60 bg-navy-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <div 
          onClick={() => onSelectView('landing')}
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 via-teal-500/20 to-blue-600/20 p-2 ring-1 ring-cyan-500/40 shadow-glow-cyan">
            <Eye className="h-6 w-6 text-cyan-400" />
            <div className="absolute inset-0 rounded-xl bg-cyan-400/10 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-white">Netra<span className="text-cyan-400">Drishti</span></span>
              <span className="rounded-full bg-cyan-950/80 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 ring-1 ring-cyan-500/30">
                v1.0 AI
              </span>
            </div>
            <p className="text-[11px] font-medium tracking-wide text-slate-400 hidden sm:block">
              AI-Powered Retinal Pathology Diagnostics
            </p>
          </div>
        </div>

        {/* Center Navigation */}
        <nav className="flex items-center gap-1 rounded-xl bg-navy-900/80 p-1 ring-1 ring-navy-700/60">
          <button
            onClick={() => onSelectView('landing')}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeView === 'landing'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm ring-1 ring-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/60'
            }`}
          >
            Platform Overview
          </button>
          <button
            onClick={() => onSelectView('workspace')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeView === 'workspace'
                ? 'bg-cyan-500/20 text-cyan-300 shadow-sm ring-1 ring-cyan-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-navy-800/60'
            }`}
          >
            <Activity className="h-3.5 w-3.5 text-cyan-400" />
            Analysis Workspace
          </button>
        </nav>

        {/* Right Status & Actions */}
        <div className="flex items-center gap-3">
          {/* Health status pill */}
          <div 
            onClick={onRefreshHealth}
            title="Click to check backend status"
            className="group flex cursor-pointer items-center gap-2 rounded-full border border-navy-700 bg-navy-900/90 px-3 py-1 text-xs transition-colors hover:border-navy-600"
          >
            {healthLoading ? (
              <>
                <RefreshCw className="h-3 w-3 animate-spin text-cyan-400" />
                <span className="text-slate-400 text-[11px]">Checking...</span>
              </>
            ) : isHealthy ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] font-medium text-emerald-400">
                  Ready ({health?.device?.toUpperCase() || 'CPU'})
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 text-rose-400" />
                <span className="text-[11px] font-medium text-rose-400">
                  Backend Offline
                </span>
              </>
            )}
          </div>

          {/* API Docs Link */}
          <a
            href="http://localhost:8000/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-1.5 rounded-lg border border-navy-700/80 bg-navy-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-cyan-500/40 hover:text-cyan-300 md:flex"
          >
            <span>Swagger API</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </header>
  );
};
