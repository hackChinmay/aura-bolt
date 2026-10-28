import React, { useState } from 'react';
import { BookOpen, ShieldCheck, Code, Network, Terminal, CheckCircle2 } from 'lucide-react';

export const ResearchDocs: React.FC = () => {
  const [activeSection, setActiveSection] = useState<'problem' | 'math' | 'protocols' | 'prior_art' | 'local_run'>('problem');

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-200">ACADEMIC SPECIFICATION</span>
            <span>·</span>
            <span>Research Paper &amp; Protocol Verification Dossier</span>
          </div>
          <h2 className="text-base font-semibold text-white">
            AURA-BOLT: Adaptive ARQ &amp; Sliding Window Optimization
          </h2>
        </div>

        {/* Section Nav */}
        <div className="flex flex-wrap items-center p-0.5 bg-slate-950 border border-slate-800 rounded text-xs font-medium">
          {(
            [
              ['problem', 'Problem Statement'],
              ['math', 'Mathematical Formulation'],
              ['protocols', 'Protocol State Machines'],
              ['prior_art', 'Prior Art & Patentability'],
              ['local_run', 'Local Reproduction Guide'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`px-3 py-1.5 rounded transition-colors ${
                activeSection === key
                  ? 'bg-slate-800 text-cyan-400 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section */}
      <div className="bg-slate-900 border border-slate-800 rounded p-6 text-xs text-slate-300 leading-relaxed font-sans space-y-5">
        {activeSection === 'problem' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
              1. Problem Statement &amp; Motivation
            </h3>
            <p>
              In conventional transport protocols, Automatic Repeat reQuest (ARQ) mechanisms operate with fixed sliding window parameters or react uniformly to packet loss regardless of whether the loss stems from isolated random bit errors (Bernoulli process) or correlated fading bursts (Gilbert-Elliott Markov process).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-[11px] pt-2">
              <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                <div className="font-bold text-white mb-1">Stop-and-Wait ARQ</div>
                <div className="text-slate-400">
                  Transmits 1 frame per RTT. While memory-efficient, link utilization is bounded by <code>1 / (1 + 2a)</code> where <code>a = Delay / TransmissionTime</code>. Over high Bandwidth-Delay Product (BDP) links (e.g. satellite), the channel remains drastically idle.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                <div className="font-bold text-white mb-1">Go-Back-N ARQ</div>
                <div className="text-slate-400">
                  Permits up to <code>W</code> outstanding frames with cumulative ACKs. However, when 1 frame is dropped, the receiver discards all subsequent out-of-order frames, forcing retransmission of the entire window <code>[base ... next_seq - 1]</code> and causing severe goodput collapse during bursts.
                </div>
              </div>

              <div className="bg-slate-950 p-3.5 rounded border border-slate-800">
                <div className="font-bold text-white mb-1">Selective Repeat ARQ</div>
                <div className="text-slate-400">
                  Retransmits only missing frames using individual ACKs and out-of-order receiver buffering. However, fixed-window sizing fails under burst loss: an oversized window floods the channel during deep fades, while an undersized window starves high-capacity pipes.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'math' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
              2. Mathematical Formulation &amp; Multi-Objective Optimization
            </h3>
            <p>
              AURA-BOLT implements an online multi-objective scalarization function <code>J(w)</code> evaluated across candidate window sizes <code>w ∈ C</code> at every decision epoch:
            </p>
            <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-cyan-300 text-xs">
              J(w) = α · (G_pred(w) / C_link) - β · (L_pred(w) / 3·SRTT) - γ · (R_pred(w) / w) - δ · (B_pred(w) / B_max)
            </div>
            <p>Subject to physical and protocol safety constraints:</p>
            <ul className="list-disc pl-5 space-y-1 text-slate-400">
              <li>
                <strong className="text-slate-200">Receiver Buffer Invariant:</strong> <code>w ≤ B_max</code>.
              </li>
              <li>
                <strong className="text-slate-200">Sequence Modulus Safety Invariant:</strong> <code>w ≤ ⌊M / 2⌋</code> for sequence modulus <code>M</code> (prevents window aliasing).
              </li>
              <li>
                <strong className="text-slate-200">Normalized Convex Combination:</strong> <code>α + β + γ + δ = 1.0</code>.
              </li>
            </ul>
            <div className="pt-2">
              <h4 className="text-xs font-bold text-white mb-1">Gilbert-Elliott Channel State Multiplier</h4>
              <p className="text-slate-400">
                When consecutive frame drops exceed the threshold <code>consecutive_losses ≥ 2</code> or recent loss rate exceeds 25%, the channel is classified in the BAD burst state. The predicted recovery cost multiplier scales proportionally to <code>1.0 + 0.4 · μ_burst</code>, penalizing oversized windows and triggering conservative recovery.
              </p>
            </div>
          </div>
        )}

        {activeSection === 'protocols' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
              3. Protocol State Machines &amp; Invariant Proofs
            </h3>
            <p>
              Each ARQ state machine was constructed from formal state transition rules:
            </p>
            <div className="space-y-3 font-mono text-xs">
              <div className="bg-slate-950 p-3 rounded border border-slate-800">
                <div className="text-white font-bold mb-1">Selective Repeat Sequence Safety Proof</div>
                <div className="text-slate-400 text-[11px] leading-relaxed">
                  Theorem: For a circular sequence modulus M with symmetric sender and receiver windows Ws = Wr = W, no ambiguity between old duplicate frames and new frames can occur if and only if:
                  <div className="text-cyan-300 my-1">Ws + Wr ≤ M  ==&gt;  2W ≤ M  ==&gt;  W ≤ ⌊M / 2⌋</div>
                  Proof: Suppose the receiver has window [R_base, R_base + W - 1] and all W ACKs are lost. The sender retransmits R_base. If W &gt; M/2, the highest sequence number in the receiver's next window would overlap with R_base modulo M, causing duplicate data to be erroneously accepted as fresh frames. By enforcing W ≤ M/2, the set of old unacknowledged sequence numbers and the set of next-generation sequence numbers are strictly disjoint.
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'prior_art' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
              4. Prior Art Review &amp; Academic Novelty Inquiry
            </h3>
            <p>
              To uphold strict scientific integrity, patentability is treated as an open academic inquiry rather than an asserted claim.
            </p>
            <div className="space-y-3 text-slate-400">
              <div>
                <strong className="text-slate-200">RFC 793 &amp; RFC 5681 (TCP):</strong> Sliding window mechanisms, cumulative acknowledgements, and AIMD congestion control constitute 40+ years of public domain foundational prior art.
              </div>
              <div>
                <strong className="text-slate-200">RFC 6298 (Jacobson-Karels RTO):</strong> Retransmission timeout estimation using SRTT and RTTVAR is public standard literature. AURA-BOLT utilizes RFC 6298 formulas directly.
              </div>
              <div>
                <strong className="text-slate-200">RFC 2018 (TCP SACK):</strong> Selective acknowledgement options for out-of-order packet recovery.
              </div>
              <div>
                <strong className="text-slate-200">Gilbert-Elliott Channel Model (1960, 1963):</strong> Foundational literature for burst channels.
              </div>
              <div className="bg-slate-950 p-3 rounded border border-slate-800 text-xs text-slate-300">
                <span className="text-cyan-400 font-bold">Investigation Finding:</span> AURA-BOLT is designed as an open, reproducible research benchmark platform. Its multi-objective scalarization <code>J(c)</code> and online Gilbert-Elliott transition estimator provide measurable experimental value in bursty wireless scenarios without infringing proprietary patents.
              </div>
            </div>
          </div>
        )}

        {activeSection === 'local_run' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider text-cyan-400">
              5. Local Reproduction &amp; Evaluation Panel Guide
            </h3>
            <p>
              The project is 100% reproducible. You can run the full-stack web application (Node.js/Express with native UDP sockets) or the Python FastAPI test suite:
            </p>

            <div className="bg-slate-950 p-4 rounded border border-slate-800 font-mono text-xs space-y-2 text-cyan-300">
              <div className="text-slate-500"># 1. Run Full-Stack Research Web App (Node + Express + dgram UDP)</div>
              <div>npm install</div>
              <div>npm run dev</div>
              <div className="text-slate-500 pt-2"># 2. Run Python FastAPI Backend &amp; Automated Pytest Suite</div>
              <div>cd backend</div>
              <div>python3 -m venv venv &amp;&amp; source venv/bin/activate</div>
              <div>pip install -r requirements.txt</div>
              <div>pytest tests/ -v</div>
              <div>uvicorn app.main:app --port 8000 --reload</div>
            </div>

            <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs pt-1">
              <CheckCircle2 className="w-4 h-4" />
              <span>Deterministic random seeds guarantee bit-for-bit reproducible results across repeated runs.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
