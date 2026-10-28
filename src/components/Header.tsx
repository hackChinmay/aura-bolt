import React from 'react';
import { Play, Pause, RotateCcw, Activity } from 'lucide-react';
import { PageId } from './Sidebar';

interface HeaderProps {
  currentPage: PageId;
  isRunning: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  executionMode: 'simulation' | 'real_udp';
  onChangeExecutionMode: (mode: 'simulation' | 'real_udp') => void;
  randomSeed: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  isRunning,
  onToggleRun,
  onReset,
  executionMode,
  onChangeExecutionMode,
  randomSeed,
}) => {
  const pageTitles: Record<PageId, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Research Dashboard',
      subtitle: 'Real-time telemetry, channel states, and transmission metrics',
    },
    packet_lab: {
      title: 'Live Packet Laboratory',
      subtitle: 'Animated frame transit, ACK flow, sliding window, and packet inspection',
    },
    comparison: {
      title: 'Protocol Comparison',
      subtitle: 'Controlled benchmarks: Stop-and-Wait vs GBN vs Selective Repeat vs AURA-BOLT',
    },
    adaptive: {
      title: 'Adaptive Controller Inspector',
      subtitle: '8-step Predict-Apply-Verify loop, Gilbert-Elliott burst tracking, and candidate scoring',
    },
    builder: {
      title: 'Experiment Builder',
      subtitle: 'Configurable delay, jitter, loss patterns, window sizes, and Real UDP file transfers',
    },
    results: {
      title: 'Results & Research Analysis',
      subtitle: 'Statistical distributions, confidence intervals, CSV export, and ablation analysis',
    },
    docs: {
      title: 'Research Documentation',
      subtitle: 'Formal specification, state machines, and patentability evaluation',
    },
  };

  const { title, subtitle } = pageTitles[currentPage];

  return (
    <header className="h-16 bg-slate-900/90 backdrop-blur border-b border-slate-800 px-6 flex items-center justify-between shrink-0 select-none">
      <div>
        <h1 className="text-base font-semibold text-white tracking-tight">{title}</h1>
        <p className="text-xs text-slate-400">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Mode Selector */}
        <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded">
          <button
            onClick={() => onChangeExecutionMode('simulation')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              executionMode === 'simulation'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Deterministic Simulator
          </button>
          <button
            onClick={() => onChangeExecutionMode('real_udp')}
            className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
              executionMode === 'real_udp'
                ? 'bg-slate-800 text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Real UDP Transfer
          </button>
        </div>

        {/* Seed Info */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-400 px-2 py-1 bg-slate-950/60 border border-slate-800 rounded font-mono">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Seed: {randomSeed}</span>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleRun}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              isRunning
                ? 'bg-amber-600 hover:bg-amber-500 text-white'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Experiment</span>
              </>
            )}
          </button>

          <button
            onClick={onReset}
            title="Reset Experiment"
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
