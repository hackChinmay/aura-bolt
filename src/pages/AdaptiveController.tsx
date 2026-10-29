import React, { useState } from 'react';
import { ControllerDecision, ExperimentConfig } from '../core/types';
import {
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  TrendingUp,
  ShieldAlert,
  ArrowRight,
  Info,
  Activity,
  Layers,
  Clock,
  Zap,
  Gauge,
  Workflow,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AdaptiveControllerPageProps {
  decisions: ControllerDecision[];
  config: ExperimentConfig;
}

export const AdaptiveControllerPage: React.FC<AdaptiveControllerPageProps> = ({
  decisions,
  config,
}) => {
  const [selectedDecisionId, setSelectedDecisionId] = useState<string | null>(
    decisions.length > 0 ? decisions[decisions.length - 1].id : null
  );
  const [expandedDecisionId, setExpandedDecisionId] = useState<string | null>(null);

  const activeDecision =
    decisions.find((d) => d.id === selectedDecisionId) ??
    (decisions.length > 0 ? decisions[decisions.length - 1] : null);

  const pipelineStages = [
    { key: 'OBSERVE', name: 'OBSERVE', desc: 'Sample RTT & loss via Karn filter' },
    { key: 'ESTIMATE', name: 'ESTIMATE', desc: 'Gilbert-Elliott Markov transition P(G→B)' },
    { key: 'PREDICT', name: 'PREDICT', desc: 'Forecast Ĝ(w), L̂(w), R̂(w) under candidates' },
    { key: 'SELECT', name: 'SELECT', desc: 'Maximize scalar objective J(w)' },
    { key: 'APPLY', name: 'APPLY', desc: 'Enforce window bounds & sliding pointers' },
    { key: 'VERIFY', name: 'VERIFY', desc: 'Audit measured vs predicted goodput' },
  ];

  const totalDecisions = decisions.length;
  const verifiedCount = decisions.filter((d) => d.status === 'VERIFIED').length;
  const fallbackCount = decisions.filter((d) => d.mode === 'FALLBACK').length;
  const avgPredictionError =
    totalDecisions > 0
      ? Math.round(
          decisions.reduce((acc, d) => acc + (d.predictionError ?? 0), 0) / totalDecisions
        )
      : 0;

  // Active inputs fallback if no decisions yet
  const inputs = activeDecision?.inputs ?? {
    srtt: config.oneWayDelayMs * 2,
    rttvar: config.jitterMs * 2,
    recentLossRate: config.packetLossRate,
    burstProbability: 0.12,
    channelState: 'GOOD',
    receiverBufferOccupancy: 2,
    windowUtilization: 0.75,
    measuredGoodputKbps: 3400,
    bdpFrames: 12,
  };

  return (
    <div className="p-5 lg:p-6 space-y-6 overflow-y-auto select-none bg-[#101216] text-[#F3F4F6]">
      {/* Top Banner & Control Objective Formula */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#343B48]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#9CA3AF]">
              <Workflow className="w-4 h-4 text-[#A78BFA]" />
              <span className="font-bold text-[#F3F4F6] uppercase tracking-wider">
                ADAPTIVE CONTROLLER DEBUGGING WORKSTATION
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Closed-loop multi-objective optimization engine with Gilbert-Elliott burst-loss tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="bg-[#101216] px-3 py-1.5 rounded-lg border border-[#343B48] flex items-center gap-2">
              <span className="text-[#9CA3AF]">Ablation:</span>
              <span
                className={`font-bold ${
                  config.enableBurstAwareness ? 'text-[#34D399]' : 'text-[#FBBF24]'
                }`}
              >
                {config.enableBurstAwareness ? 'BURST-AWARE (ON)' : 'BERNOULLI-ONLY'}
              </span>
            </div>
            <div className="bg-[#101216] px-3 py-1.5 rounded-lg border border-[#343B48] flex items-center gap-2">
              <span className="text-[#9CA3AF]">Decisions:</span>
              <span className="text-[#A78BFA] font-bold">{totalDecisions}</span>
            </div>
            <div className="bg-[#101216] px-3 py-1.5 rounded-lg border border-[#343B48] flex items-center gap-2">
              <span className="text-[#9CA3AF]">Fallbacks:</span>
              <span
                className={
                  fallbackCount > 0 ? 'text-[#FB7185] font-bold' : 'text-[#34D399] font-bold'
                }
              >
                {fallbackCount}
              </span>
            </div>
          </div>
        </div>

        {/* Objective Function Display */}
        <div className="bg-[#101216] p-3 rounded-lg border border-[#343B48] font-mono text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#A78BFA]">
            <span className="font-bold">Objective:</span>
            <span>J(w) = α · Ĝ(w) - β · L̂(w) - γ · R̂(w) - δ · B̂(w)</span>
          </div>
          <div className="text-[11px] text-[#9CA3AF]">
            Weights: α={config.alpha} (Goodput), β={config.beta} (Latency), γ={config.gamma} (Retrans), δ={config.delta} (Buffer)
          </div>
        </div>
      </div>

      {/* 3-COLUMN SPLIT ANALYTICAL LAYOUT */}
      <div className="grid grid-cols-12 gap-5">
        {/* LEFT PANEL: NETWORK STATE (Cols 1-4) */}
        <div className="col-span-12 lg:col-span-4 bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#343B48]">
            <span className="text-xs font-bold text-[#F3F4F6] font-mono uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-[#60A5FA]" />
              ESTIMATED NETWORK STATE
            </span>
            <span
              className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded border ${
                inputs.channelState === 'GOOD'
                  ? 'bg-[#12352C] text-[#34D399] border-[#34D399]/40'
                  : 'bg-[#3A2029] text-[#FB7185] border-[#FB7185]/40 animate-pulse'
              }`}
            >
              {inputs.channelState}
            </span>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="p-2.5 bg-[#101216] rounded-lg border border-[#343B48] flex justify-between items-center">
              <span className="text-[#9CA3AF]">Smoothed RTT:</span>
              <span className="text-[#60A5FA] font-bold">{Math.round(inputs.srtt)} ms</span>
            </div>
            <div className="p-2.5 bg-[#101216] rounded-lg border border-[#343B48] flex justify-between items-center">
              <span className="text-[#9CA3AF]">RTT Variation:</span>
              <span className="text-[#F3F4F6] font-bold">±{Math.round(inputs.rttvar)} ms</span>
            </div>
            <div className="p-2.5 bg-[#101216] rounded-lg border border-[#343B48] flex justify-between items-center">
              <span className="text-[#9CA3AF]">Recent Loss Rate:</span>
              <span
                className={`font-bold ${
                  inputs.recentLossRate > 0.05 ? 'text-[#FB7185]' : 'text-[#34D399]'
                }`}
              >
                {(inputs.recentLossRate * 100).toFixed(1)}%
              </span>
            </div>
            <div className="p-2.5 bg-[#101216] rounded-lg border border-[#343B48] flex justify-between items-center">
              <span className="text-[#9CA3AF]">Burst Fade Probability:</span>
              <span className="text-[#FBBF24] font-bold">
                {(inputs.burstProbability * 100).toFixed(1)}%
              </span>
            </div>
            <div className="p-2.5 bg-[#101216] rounded-lg border border-[#343B48] flex justify-between items-center">
              <span className="text-[#9CA3AF]">Estimated BDP:</span>
              <span className="text-[#A78BFA] font-bold">{inputs.bdpFrames} frames</span>
            </div>
            <div className="p-2.5 bg-[#101216] rounded-lg border border-[#343B48] flex justify-between items-center">
              <span className="text-[#9CA3AF]">Receiver Buffer Load:</span>
              <span className="text-[#34D399] font-bold">
                {inputs.receiverBufferOccupancy} / {config.receiverBufferSize || 32} frames
              </span>
            </div>
          </div>
        </div>

        {/* CENTER PANEL: DECISION PIPELINE (Cols 5-8) */}
        <div className="col-span-12 lg:col-span-4 bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#343B48]">
            <span className="text-xs font-bold text-[#F3F4F6] font-mono uppercase tracking-wider flex items-center gap-2">
              <Workflow className="w-3.5 h-3.5 text-[#A78BFA]" />
              6-STAGE DECISION PIPELINE
            </span>
            <span className="text-[10px] font-mono text-[#A78BFA]">Active Loop</span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {pipelineStages.map((stage, idx) => {
              const isActive =
                activeDecision?.step === stage.key || (!activeDecision && idx === 0);
              return (
                <div
                  key={stage.key}
                  className={`p-2.5 rounded-lg border transition-all flex items-center gap-3 ${
                    isActive
                      ? 'bg-[#252B36] border-[#A78BFA] text-[#F3F4F6] shadow-sm'
                      : 'bg-[#101216] border-[#343B48] text-[#9CA3AF]'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                      isActive
                        ? 'bg-[#A78BFA] text-[#101216]'
                        : 'bg-[#252B36] text-[#6B7280]'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-[11px] text-[#F3F4F6]">{stage.name}</div>
                    <div className="text-[10px] text-[#9CA3AF] truncate">{stage.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT PANEL: CONFIGURATION CHANGE (Cols 9-12) */}
        <div className="col-span-12 lg:col-span-4 bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#343B48]">
            <span className="text-xs font-bold text-[#F3F4F6] font-mono uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-[#FBBF24]" />
              APPLIED CONFIGURATION DELTA
            </span>
            <span className="text-[10px] font-mono text-[#34D399]">
              {activeDecision ? activeDecision.mode : 'STEADY'}
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-[#101216] rounded-lg border border-[#343B48] space-y-2">
              <div className="flex justify-between items-center text-[#9CA3AF]">
                <span>Window Size:</span>
                <span className="text-[#F3F4F6] font-bold">
                  {activeDecision ? activeDecision.previousWindow : config.initialWindowSize} →{' '}
                  <strong className="text-[#34D399]">
                    {activeDecision ? activeDecision.selectedWindow : config.initialWindowSize} frames
                  </strong>
                </span>
              </div>
              <div className="flex justify-between items-center text-[#9CA3AF]">
                <span>Retransmission RTO:</span>
                <span className="text-[#F3F4F6] font-bold">
                  {activeDecision ? activeDecision.previousRto : config.initialRtoMs}ms →{' '}
                  <strong className="text-[#60A5FA]">
                    {activeDecision ? activeDecision.selectedRto : config.initialRtoMs}ms
                  </strong>
                </span>
              </div>
              <div className="flex justify-between items-center text-[#9CA3AF]">
                <span>Protocol:</span>
                <span className="text-[#A78BFA] font-bold">
                  {activeDecision
                    ? activeDecision.selectedProtocol.replace(/_/g, ' ').toUpperCase()
                    : config.protocol.replace(/_/g, ' ').toUpperCase()}
                </span>
              </div>
            </div>

            <div className="p-3 bg-[#101216] rounded-lg border border-[#343B48] space-y-1">
              <div className="text-[10px] uppercase text-[#9CA3AF] font-bold">Decision Rationale</div>
              <div className="text-xs text-[#F3F4F6] leading-relaxed">
                {activeDecision
                  ? activeDecision.reason
                  : 'Operating at baseline window size within estimated BDP boundary.'}
              </div>
            </div>

            <div className="p-3 bg-[#101216] rounded-lg border border-[#343B48] space-y-1">
              <div className="text-[10px] uppercase text-[#9CA3AF] font-bold">Expected Outcome</div>
              <div className="text-xs text-[#34D399] leading-relaxed">
                {activeDecision
                  ? activeDecision.expectedOutcome
                  : 'Sustain maximum throughput without triggering buffer overrun.'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM SECTION: VALIDATION & HISTORICAL AUDIT TIMELINE */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#343B48]">
          <span className="font-bold text-[#F3F4F6] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
            MODEL PREDICTION AUDIT &amp; DECISION HISTORY
          </span>
          <div className="flex items-center gap-4 text-[11px] text-[#9CA3AF]">
            <span>
              Verified: <strong className="text-[#34D399]">{verifiedCount}</strong>
            </span>
            <span>
              Fallbacks: <strong className="text-[#FB7185]">{fallbackCount}</strong>
            </span>
            <span>
              Mean Prediction Error:{' '}
              <strong className="text-[#A78BFA]">±{avgPredictionError}%</strong>
            </span>
          </div>
        </div>

        {decisions.length === 0 ? (
          <div className="p-6 text-center text-[#6B7280] italic border border-dashed border-[#343B48] rounded-lg bg-[#101216]/50">
            No controller decisions recorded yet. Run an experiment on the Research Dashboard or Packet Laboratory to view the audit log.
          </div>
        ) : (
          <div className="space-y-2">
            {decisions.slice(-8).reverse().map((d) => {
              const isExpanded = expandedDecisionId === d.id;
              return (
                <div
                  key={d.id}
                  className="rounded-lg border border-[#343B48] bg-[#101216] overflow-hidden transition-all"
                >
                  <div
                    onClick={() => setExpandedDecisionId(isExpanded ? null : d.id)}
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#252B36]/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-[#A78BFA]">{d.id}</span>
                      <span className="text-[#6B7280]">·</span>
                      <span className="text-[#9CA3AF]">{d.timestamp}ms</span>
                      <span className="text-[#6B7280]">·</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#252B36] text-[#F3F4F6]">
                        {d.mode}
                      </span>
                      <span className="text-[#6B7280]">·</span>
                      <span className="text-[#F3F4F6]">
                        Window: #{d.previousWindow} → <strong className="text-[#34D399]">#{d.selectedWindow}</strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded border ${
                          d.status === 'VERIFIED'
                            ? 'bg-[#12352C] text-[#34D399] border-[#34D399]/40'
                            : 'bg-[#252B36] text-[#FBBF24] border-[#FBBF24]/40'
                        }`}
                      >
                        {d.status}
                      </span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-[#9CA3AF]" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />
                      )}
                    </div>
                  </div>

                  {/* Expandable Measurement Inputs */}
                  {isExpanded && (
                    <div className="p-4 bg-[#1D222B] border-t border-[#343B48] space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                        <div className="p-2 bg-[#101216] rounded border border-[#343B48]">
                          <div className="text-[10px] text-[#9CA3AF]">Input SRTT</div>
                          <div className="text-[#60A5FA] font-bold">{Math.round(d.inputs.srtt)} ms</div>
                        </div>
                        <div className="p-2 bg-[#101216] rounded border border-[#343B48]">
                          <div className="text-[10px] text-[#9CA3AF]">Measured Goodput</div>
                          <div className="text-[#34D399] font-bold">{Math.round(d.inputs.measuredGoodputKbps)} Kbps</div>
                        </div>
                        <div className="p-2 bg-[#101216] rounded border border-[#343B48]">
                          <div className="text-[10px] text-[#9CA3AF]">Window Util</div>
                          <div className="text-[#A78BFA] font-bold">{Math.round(d.inputs.windowUtilization * 100)}%</div>
                        </div>
                        <div className="p-2 bg-[#101216] rounded border border-[#343B48]">
                          <div className="text-[10px] text-[#9CA3AF]">Channel State</div>
                          <div className="text-[#F3F4F6] font-bold">{d.inputs.channelState}</div>
                        </div>
                      </div>
                      <div className="text-xs text-[#9CA3AF]">
                        <strong className="text-[#F3F4F6]">Decision Reason:</strong> {d.reason}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
