import React from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  StepForward,
  Activity,
  Layers,
  Sparkles,
  Command,
  Shuffle,
  ShieldCheck,
  Server,
} from 'lucide-react';
import { PageId } from './Sidebar';

interface HeaderProps {
  currentPage: PageId;
  isRunning: boolean;
  onToggleRun: () => void;
  onReset: () => void;
  onStep?: () => void;
  executionMode: 'simulation' | 'real_udp';
  onChangeExecutionMode: (mode: 'simulation' | 'real_udp') => void;
  randomSeed: number;
  experimentId?: string;
  wsConnected?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  isRunning,
  onToggleRun,
  onReset,
  onStep,
  executionMode,
  onChangeExecutionMode,
  randomSeed,
  experimentId = 'EXP-AURA-8021',
  wsConnected = false,
}) => {
  const pageMetadata: Record<
    PageId,
    { title: string; category: string; description: string }
  > = {
    dashboard: {
      category: 'OBSERVABILITY',
      title: 'Research Dashboard',
      description: 'Unified time-series telemetry, Markov channel tracking, and transmission metrics',
    },
    packet_lab: {
      category: 'INTERACTION LAB',
      title: 'Live Packet Laboratory',
      description: 'Dual-channel topology, sliding-window sequence ring, and packet inspector',
    },
    comparison: {
      category: 'BENCHMARKING',
      title: 'Protocol Comparison',
      description: 'Controlled empirical benchmark: Stop-and-Wait vs GBN vs Selective Repeat vs AURA-BOLT',
    },
    adaptive: {
      category: 'CONTROL THEORY',
      title: 'Adaptive Controller Inspector',
      description: 'Closed-loop 6-stage decision pipeline, candidate scoring, and prediction verification',
    },
    builder: {
      category: 'EXPERIMENTATION',
      title: 'Experiment Builder',
      description: 'Scenario studio: parameter sweeps, Gilbert-Elliott impairment models, and UDP file transfer',
    },
    results: {
      category: 'DATA SCIENCE',
      title: 'Results & Research Analysis',
      description: 'Statistical distributions, confidence intervals, ablation analysis, and CSV export',
    },
    docs: {
      category: 'SPECIFICATION',
      title: 'Research Documentation',
      description: 'Formal protocol specification, state machine invariants, and mathematical formulas',
    },
  };

  const { category, title, description } = pageMetadata[currentPage];

  return (
    <header className="h-16 bg-[#171A21] border-b border-[#343B48] px-5 flex items-center justify-between shrink-0 select-none z-10">
      {/* Left: Breadcrumbs & Page Title */}
      <div className="flex flex-col justify-center min-w-0 pr-4">
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#6B7280] leading-none mb-1">
          <span>AURA-BOLT</span>
          <span>/</span>
          <span className="text-[#A78BFA] font-medium tracking-wide">{category}</span>
          <span>/</span>
          <span className="text-[#9CA3AF] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-sm font-semibold text-[#F3F4F6] tracking-tight truncate">
            {title}
          </h1>
          <span className="hidden xl:inline text-xs text-[#6B7280]">·</span>
          <span className="hidden xl:inline text-[11px] text-[#9CA3AF] truncate max-w-[420px]">
            {description}
          </span>
        </div>
      </div>

      {/* Right: Technical Control Groups */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Experiment ID & Seed Indicator */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 bg-[#1D222B] border border-[#343B48] rounded text-[11px] font-mono">
          <span className="text-[#6B7280]">ID:</span>
          <span className="text-[#F3F4F6] font-medium">{experimentId}</span>
          <span className="text-[#343B48]">|</span>
          <span className="text-[#6B7280]">Seed:</span>
          <span className="text-[#A78BFA] font-semibold">{randomSeed}</span>
        </div>

        {/* Execution Mode Selector */}
        <div className="flex items-center p-0.5 bg-[#101216] border border-[#343B48] rounded text-xs font-mono">
          <button
            onClick={() => onChangeExecutionMode('simulation')}
            className={`px-2.5 py-1 rounded transition-all text-[11px] ${
              executionMode === 'simulation'
                ? 'bg-[#1D222B] text-[#A78BFA] font-semibold shadow-sm border border-[#A78BFA]/30'
                : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
            }`}
            title="Run reproducible discrete-event simulation engine"
          >
            Deterministic Sim
          </button>
          <button
            onClick={() => onChangeExecutionMode('real_udp')}
            className={`px-2.5 py-1 rounded transition-all text-[11px] ${
              executionMode === 'real_udp'
                ? 'bg-[#1D222B] text-[#FBBF24] font-semibold shadow-sm border border-[#FBBF24]/30'
                : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
            }`}
            title="Transmit packets over genuine Linux UDP sockets (port 19001 -> 19002)"
          >
            Real UDP Transfer
          </button>
        </div>

        {/* Backend & WS Status Indicator */}
        <div
          className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-[#1D222B] border border-[#343B48] rounded text-[11px] font-mono"
          title={
            wsConnected
              ? 'Backend WebSocket & UDP socket server online'
              : 'Local in-memory discrete-event simulation engine active'
          }
        >
          <span
            className={`w-2 h-2 rounded-full ${
              wsConnected ? 'bg-[#34D399] shadow-sm shadow-[#34D399]/50' : 'bg-[#60A5FA]'
            }`}
          />
          <span className="text-[#9CA3AF]">
            {wsConnected ? 'BACKEND ONLINE' : 'SIMULATOR ACTIVE'}
          </span>
        </div>

        {/* Primary Simulation Controls */}
        <div className="flex items-center gap-1.5 pl-1 border-l border-[#343B48]">
          {onStep && (
            <button
              onClick={onStep}
              disabled={isRunning}
              className="p-1.5 bg-[#1D222B] hover:bg-[#252B36] disabled:opacity-40 text-[#9CA3AF] hover:text-[#F3F4F6] rounded border border-[#343B48] transition-colors group relative"
              title="Single-Step Event (Key: S)"
            >
              <StepForward className="w-3.5 h-3.5" />
              <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#101216] border border-[#343B48] text-[9px] font-mono text-[#F3F4F6] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                Step (S)
              </span>
            </button>
          )}

          <button
            onClick={onReset}
            className="p-1.5 bg-[#1D222B] hover:bg-[#252B36] text-[#9CA3AF] hover:text-[#F3F4F6] rounded border border-[#343B48] transition-colors group relative"
            title="Reset Simulation State (Key: R)"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-[#101216] border border-[#343B48] text-[9px] font-mono text-[#F3F4F6] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
              Reset (R)
            </span>
          </button>

          <button
            onClick={onToggleRun}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded tracking-wide transition-all shadow-sm ${
              isRunning
                ? 'bg-[#FBBF24]/20 hover:bg-[#FBBF24]/30 text-[#FBBF24] border border-[#FBBF24]/50'
                : 'bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#101216] font-bold border border-[#A78BFA]'
            }`}
            title="Toggle Engine Run/Pause (Key: Space)"
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run</span>
              </>
            )}
            <span className="text-[10px] font-mono opacity-80 ml-0.5">␣</span>
          </button>
        </div>
      </div>
    </header>
  );
};
