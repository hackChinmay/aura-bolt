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
  const [selectedStepFilter, setSelectedStepFilter] = useState<string | null>(null);

  const activeDecision =
    decisions.find((d) => d.id === selectedDecisionId) ??
    (decisions.length > 0 ? decisions[decisions.length - 1] : null);

  const stepsList = [
    { num: '1', name: 'OBSERVE', desc: 'Sample RTT & loss sequence via Karn filtering' },
    { num: '2', name: 'PREDICT', desc: 'Forecast G, L, R under Markov Gilbert-Elliott states' },
    { num: '3', name: 'SELECT', desc: 'Maximize multi-objective scalar utility J(w)' },
    { num: '4', name: 'APPLY', desc: 'Enforce window bounds & update sender sliding bounds' },
    { num: '5', name: 'MEASURE', desc: 'Accumulate transit metrics over post-change interval' },
    { num: '6', name: 'VERIFY', desc: 'Validate actual goodput against model prediction' },
    { num: '7', name: 'UPDATE', desc: 'Refine transition probabilities P(G->B) & P(B->B)' },
    { num: '8', name: 'FALLBACK', desc: 'Safe reset if misprediction threshold exceeded' },
  ];

  // Calculate statistics across decisions
  const totalDecisions = decisions.length;
  const verifiedCount = decisions.filter((d) => d.status === 'VERIFIED').length;
  const fallbackCount = decisions.filter((d) => d.mode === 'FALLBACK').length;
  const avgPredictionError = totalDecisions > 0
    ? Math.round(
        decisions.reduce((acc, d) => acc + (d.predictionError ?? 0), 0) / totalDecisions
      )
    : 0;

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Top Banner & Control Architecture */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-200 uppercase tracking-wider">AURA-BOLT CONTROLLER INSPECTOR</span>
            <span>·</span>
            <span className="text-cyan-400 font-mono">Closed-Loop 8-Step Adaptive Engine</span>
            <span>·</span>
            <span>Jacobson-Karels + Gilbert-Elliott Estimator</span>
          </div>
          <div className="text-xs text-slate-300 font-mono">
            Objective: <span className="text-cyan-400 font-bold">J(w) = α·Ĝ(w) - β·L̂(w) - γ·R̂(w) - δ·B̂(w)</span>
            <span className="text-slate-500 ml-2">
              (α={config.alpha}, β={config.beta}, γ={config.gamma}, δ={config.delta})
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Ablation:</span>
            <span
              className={
                config.enableBurstAwareness ? 'text-emerald-400 font-bold' : 'text-amber-400'
              }
            >
              {config.enableBurstAwareness ? 'BURST-AWARE (ON)' : 'BERNOULLI-ONLY (OFF)'}
            </span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Audit Records:</span>
            <span className="text-cyan-400 font-bold">{totalDecisions}</span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800 flex items-center gap-2">
            <span className="text-slate-400">Fallbacks:</span>
            <span className={fallbackCount > 0 ? 'text-rose-400 font-bold' : 'text-slate-300 font-bold'}>
              {fallbackCount}
            </span>
          </div>
        </div>
      </div>

      {/* 8-Step Closed-Loop Lifecycle Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-cyan-400" />
            <span className="font-semibold text-slate-200 uppercase tracking-wider">
              8-Step Closed-Loop Control Architecture
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            Active Phase: {activeDecision?.step ?? 'STANDBY / READY'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {stepsList.map((step) => {
            const isActive = activeDecision?.step === step.name;
            return (
              <div
                key={step.num}
                className={`p-2.5 rounded border text-xs font-mono transition-all ${
                  isActive
                    ? 'bg-cyan-950/60 border-cyan-400 text-cyan-200 shadow-sm'
                    : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-bold ${isActive ? 'text-cyan-300' : 'text-slate-500'}`}>
                    STEP {step.num}
                  </span>
                  {isActive && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                </div>
                <div className={`font-bold text-[11px] truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>
                  {step.name}
                </div>
                <div className="text-[10px] text-slate-500 mt-1 line-clamp-2 leading-tight">
                  {step.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded p-12 text-center text-slate-400 text-xs italic">
          No controller decisions recorded yet. Run an experiment with AURA-BOLT selected to observe live decisions and candidate scoring.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Decision Timeline Column (Cols 1-4) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-semibold text-white">Decision Ledger</span>
              <span className="text-slate-500 text-[10px]">Recent First ({decisions.length})</span>
            </div>

            <div className="space-y-2 max-h-[620px] overflow-y-auto pr-1">
              {decisions.slice().reverse().map((d, idx) => {
                const isSelected = activeDecision?.id === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDecisionId(d.id)}
                    className={`w-full text-left p-3 rounded border text-xs font-mono transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200'
                        : 'bg-slate-950 border-slate-800/80 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white">#{decisions.length - idx}</span>
                      <span className="text-[10px] text-slate-500">{Math.round(d.timestamp)} ms</span>
                    </div>

                    <div className="flex items-center gap-1.5 my-1 text-[11px]">
                      <span className="text-slate-400">W: {d.previousWindow}</span>
                      <ArrowRight className="w-3 h-3 text-cyan-400" />
                      <span className="text-white font-bold">W: {d.selectedWindow}</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">RTO: {d.selectedRto}ms</span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-900">
                      <span className="truncate text-slate-400">{d.mode}</span>
                      <span
                        className={`font-semibold ${
                          d.status === 'VERIFIED'
                            ? 'text-emerald-400'
                            : d.status === 'REVERTED'
                            ? 'text-rose-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {d.status}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Decision Breakdown (Cols 5-12) */}
          {activeDecision && (
            <div className="lg:col-span-8 space-y-4">
              {/* Selected Decision Detail Header */}
              <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white font-mono">{activeDecision.id}</span>
                    <span className="text-slate-500">·</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${
                        activeDecision.mode === 'OPTIMAL'
                          ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                          : activeDecision.mode === 'CONSERVATIVE_RECOVERY'
                          ? 'bg-amber-950 text-amber-400 border border-amber-500/30'
                          : 'bg-rose-950 text-rose-400 border border-rose-500/30'
                      }`}
                    >
                      MODE: {activeDecision.mode}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono">
                    Simulation Clock: <span className="text-white font-bold">{Math.round(activeDecision.timestamp)} ms</span>
                  </div>
                </div>

                {/* Plain-English Explanation */}
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs space-y-1.5">
                  <div className="font-semibold text-cyan-300">Closed-Loop Controller Rationale:</div>
                  <div className="text-slate-300 leading-relaxed">{activeDecision.reason}</div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <span className="text-slate-500">Anticipated Equilibrium Outcome:</span>{' '}
                    <span className="text-slate-200">{activeDecision.expectedOutcome}</span>
                  </div>
                </div>

                {/* Telemetry Inputs Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">SMOOTHED RTT (SRTT)</span>
                    <div className="text-white font-bold mt-0.5">{activeDecision.inputs.srtt} ms</div>
                    <span className="text-[10px] text-slate-500">RTTVAR: {activeDecision.inputs.rttvar} ms</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">MEASURED LOSS RATE</span>
                    <div className="text-amber-400 font-bold mt-0.5">
                      {Math.round(activeDecision.inputs.recentLossRate * 100)}%
                    </div>
                    <span className="text-[10px] text-slate-500">Window: 16 frames</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">MARKOV CHANNEL STATE</span>
                    <div
                      className={`font-bold mt-0.5 ${
                        activeDecision.inputs.channelState === 'BAD'
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {activeDecision.inputs.channelState} (P_burst: {Math.round(activeDecision.inputs.burstProbability * 100)}%)
                    </div>
                    <span className="text-[10px] text-slate-500">Gilbert-Elliott state</span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">BDP PIPE CAPACITY</span>
                    <div className="text-cyan-400 font-bold mt-0.5">
                      {activeDecision.inputs.bdpFrames} Frames
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Buffer: {activeDecision.inputs.receiverBufferOccupancy}/{config.receiverBufferSize}
                    </span>
                  </div>
                </div>
              </div>

              {/* Gilbert-Elliott Markov State Machine & Jacobson-Karels Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Markov State Transition Box */}
                <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-semibold text-white">Gilbert-Elliott Transition Matrix</span>
                    <span className="text-[10px] text-cyan-400">Markov Memory Model</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">P(GOOD → BAD)</div>
                      <div className="text-white font-bold mt-0.5">
                        {config.burstProbabilityGoodToBad.toFixed(3)}
                      </div>
                      <div className="text-[9px] text-slate-500">Fade onset rate</div>
                    </div>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800">
                      <div className="text-slate-500 text-[10px]">P(BAD → BAD)</div>
                      <div className="text-rose-400 font-bold mt-0.5">
                        {config.burstProbabilityBadToBad.toFixed(3)}
                      </div>
                      <div className="text-[9px] text-slate-500">
                        Mean burst: {(1 / (1 - config.burstProbabilityBadToBad)).toFixed(1)} frames
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 leading-normal">
                    Under burst fades, the controller temporarily suppresses window expansion to avoid dropping full consecutive trains of packets.
                  </div>
                </div>

                {/* Jacobson-Karels RFC 6298 Box */}
                <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                    <span className="font-semibold text-white">RFC 6298 RTO Estimator</span>
                    <span className="text-[10px] text-amber-400">Karn's Filtering</span>
                  </div>
                  <div className="space-y-1 text-slate-300 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">SRTT:</span>
                      <span className="text-white font-bold">{activeDecision.inputs.srtt} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">RTTVAR:</span>
                      <span className="text-white font-bold">{activeDecision.inputs.rttvar} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">RTO Formula:</span>
                      <span className="text-amber-400 font-bold">SRTT + 4·RTTVAR</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-slate-950">
                      <span className="text-slate-400 font-semibold">Calculated RTO:</span>
                      <span className="text-cyan-300 font-bold">{activeDecision.selectedRto} ms</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Candidates Evaluation Table */}
              <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                  <span className="font-semibold text-white">Evaluated Candidate Windows &amp; Utility J(w)</span>
                  <span className="text-slate-500 text-[10px]">
                    Candidate space: [1, 2, 4, W/2, W, W+1, W+2, BDP]
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Candidate (W)</th>
                        <th className="py-2 px-3">Pred. Goodput (Ĝ)</th>
                        <th className="py-2 px-3">Pred. P95 (L̂)</th>
                        <th className="py-2 px-3">Pred. Retx (R̂)</th>
                        <th className="py-2 px-3">Utility J(w)</th>
                        <th className="py-2 px-3">Feasibility Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {activeDecision.candidates.map((cand) => {
                        const isChosen = cand.windowSize === activeDecision.selectedWindow;
                        return (
                          <tr
                            key={`cand-${cand.windowSize}`}
                            className={isChosen ? 'bg-cyan-950/30 text-cyan-200' : 'hover:bg-slate-800/30'}
                          >
                            <td className="py-2 px-3 font-bold">
                              <span className="flex items-center gap-1.5">
                                {isChosen && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                                W = {cand.windowSize} frames
                              </span>
                            </td>
                            <td className="py-2 px-3 text-cyan-400">{cand.predictedGoodputKbps} Kbps</td>
                            <td className="py-2 px-3">{cand.predictedP95LatencyMs} ms</td>
                            <td className="py-2 px-3 text-rose-300">{cand.predictedRetransCost} frames</td>
                            <td className="py-2 px-3 font-bold text-white">{cand.objectiveScore}</td>
                            <td className="py-2 px-3">
                              {cand.isFeasible ? (
                                <span className="text-emerald-400 flex items-center gap-1 text-[10px]">
                                  <CheckCircle2 className="w-3 h-3" /> Feasible
                                </span>
                              ) : (
                                <span className="text-rose-400 text-[10px]">
                                  Infeasible: {cand.rejectionReason}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Verification & Safe Fallback Audit */}
              <div className="bg-slate-900 border border-slate-800 rounded p-4 text-xs font-mono space-y-3">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                  <span className="font-semibold text-white">Closed-Loop Verification &amp; Guardrail Status</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      activeDecision.status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        : activeDecision.status === 'REVERTED'
                        ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    STATUS: {activeDecision.status}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-slate-300">
                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Observed Post-Change</span>
                    <span className="text-white font-bold mt-0.5 block">
                      {activeDecision.observedGoodputKbps
                        ? `${activeDecision.observedGoodputKbps} Kbps`
                        : 'Awaiting measurement window...'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Prediction Error |Ĝ - G|</span>
                    <span className="text-cyan-400 font-bold mt-0.5 block">
                      {activeDecision.predictionError !== undefined
                        ? `${activeDecision.predictionError} Kbps`
                        : 'Evaluating'}
                    </span>
                  </div>

                  <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px] block">Safe Fallback Guardrail</span>
                    <span
                      className={`font-bold mt-0.5 block ${
                        activeDecision.mode === 'FALLBACK' ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {activeDecision.mode === 'FALLBACK' ? 'FALLBACK TRIGGERED' : 'GUARDRAIL CLEAR'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
