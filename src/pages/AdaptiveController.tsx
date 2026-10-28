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

  const activeDecision =
    decisions.find((d) => d.id === selectedDecisionId) ??
    (decisions.length > 0 ? decisions[decisions.length - 1] : null);

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-200">AURA-BOLT CLOSED-LOOP OPTIMIZER</span>
            <span>·</span>
            <span>Predict-Apply-Verify Control Architecture</span>
          </div>
          <div className="text-sm text-slate-300">
            Formulation: <span className="font-mono text-cyan-400">J(w) = α·G - β·L - γ·R - δ·B</span>
            <span className="text-slate-500 ml-2">
              (α={config.alpha}, β={config.beta}, γ={config.gamma}, δ={config.delta})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400">Ablation Mode:</span>{' '}
            <span
              className={
                config.enableBurstAwareness ? 'text-emerald-400 font-bold' : 'text-amber-400'
              }
            >
              {config.enableBurstAwareness ? 'BURST-AWARE (ON)' : 'BERNOULLI-ONLY (OFF)'}
            </span>
          </div>
          <div className="bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <span className="text-slate-400">Total Decisions:</span>{' '}
            <span className="text-cyan-400 font-bold">{decisions.length}</span>
          </div>
        </div>
      </div>

      {decisions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded p-12 text-center text-slate-400 text-xs italic">
          No controller decisions recorded yet. Run the simulation with AURA-BOLT protocol selected to populate the decision log.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Decision Timeline Column (Cols 1-4) */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
              <span className="font-semibold text-white">Decision Timeline</span>
              <span className="text-slate-500 text-[10px]">Recent First</span>
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
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
                    </div>

                    <div className="text-[10px] truncate text-slate-400">{d.mode}</div>
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
                      {activeDecision.mode}
                    </span>
                  </div>

                  <div className="text-xs text-slate-400 font-mono">
                    Timestamp: <span className="text-white font-bold">{Math.round(activeDecision.timestamp)} ms</span>
                  </div>
                </div>

                {/* Plain-English Explanation */}
                <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs space-y-1.5">
                  <div className="font-semibold text-cyan-300">Decision Rationale:</div>
                  <div className="text-slate-300 leading-relaxed">{activeDecision.reason}</div>
                  <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <span className="text-slate-500">Expected Outcome:</span> {activeDecision.expectedOutcome}
                  </div>
                </div>

                {/* Input Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px]">SMOOTHED RTT</span>
                    <div className="text-white font-bold mt-0.5">{activeDecision.inputs.srtt} ms</div>
                  </div>

                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px]">MEASURED LOSS</span>
                    <div className="text-amber-400 font-bold mt-0.5">
                      {Math.round(activeDecision.inputs.recentLossRate * 100)}%
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px]">CHANNEL STATE</span>
                    <div
                      className={`font-bold mt-0.5 ${
                        activeDecision.inputs.channelState === 'BAD'
                          ? 'text-rose-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {activeDecision.inputs.channelState}
                    </div>
                  </div>

                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="text-slate-500 text-[10px]">BDP PIPE CAPACITY</span>
                    <div className="text-cyan-400 font-bold mt-0.5">
                      {activeDecision.inputs.bdpFrames} Frames
                    </div>
                  </div>
                </div>
              </div>

              {/* Candidates Evaluation Table */}
              <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-800">
                  <span className="font-semibold text-white">Evaluated Candidate Configurations</span>
                  <span className="text-slate-500 text-[10px]">
                    Objective function J(c) evaluated across candidate window sizes
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2 px-3">Candidate Window (W)</th>
                        <th className="py-2 px-3">Pred. Goodput</th>
                        <th className="py-2 px-3">Pred. P95 Latency</th>
                        <th className="py-2 px-3">Pred. Retrans</th>
                        <th className="py-2 px-3">Objective Score J(w)</th>
                        <th className="py-2 px-3">Status</th>
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
                              {cand.windowSize} Frames {isChosen && '(Selected)'}
                            </td>
                            <td className="py-2 px-3 text-cyan-400">{cand.predictedGoodputKbps} Kbps</td>
                            <td className="py-2 px-3">{cand.predictedP95LatencyMs} ms</td>
                            <td className="py-2 px-3">{cand.predictedRetransCost} frames</td>
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

              {/* Verification & Audit */}
              <div className="bg-slate-900 border border-slate-800 rounded p-4 text-xs font-mono space-y-2">
                <div className="flex items-center justify-between text-slate-400 pb-2 border-b border-slate-800">
                  <span className="font-semibold text-white">Closed-Loop Verification Status</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      activeDecision.status === 'VERIFIED'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        : activeDecision.status === 'REVERTED'
                        ? 'bg-rose-950 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-950 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {activeDecision.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-slate-300">
                  <div>
                    Observed Goodput Post-Change:{' '}
                    <span className="text-white font-bold">
                      {activeDecision.observedGoodputKbps ? `${activeDecision.observedGoodputKbps} Kbps` : 'Awaiting measurement window...'}
                    </span>
                  </div>
                  <div>
                    Prediction Error Margin:{' '}
                    <span className="text-cyan-400 font-bold">
                      {activeDecision.predictionError !== undefined ? `${activeDecision.predictionError} Kbps` : 'Evaluating'}
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
