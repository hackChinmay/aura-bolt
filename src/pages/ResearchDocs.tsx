import React, { useState } from 'react';
import {
  BookOpen,
  ShieldCheck,
  Code,
  Network,
  Terminal,
  CheckCircle2,
  Cpu,
  Layers,
  Activity,
  Workflow,
  AlertTriangle,
} from 'lucide-react';

export const ResearchDocs: React.FC = () => {
  const [activeSection, setActiveSection] = useState<
    'problem' | 'math' | 'statemachines' | 'markov' | 'prior_art' | 'local_run'
  >('problem');

  return (
    <div className="p-5 lg:p-6 space-y-6 overflow-y-auto select-none bg-[#101216] text-[#F3F4F6]">
      {/* Header */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#9CA3AF] mb-1">
            <BookOpen className="w-4 h-4 text-[#A78BFA]" />
            <span className="font-bold text-[#F3F4F6] uppercase tracking-wider">
              ACADEMIC SPECIFICATION &amp; PROTOCOL DOSSIER
            </span>
          </div>
          <h2 className="text-base font-bold text-[#F3F4F6]">
            AURA-BOLT: Burst-Aware Adaptive ARQ &amp; Sliding Window Optimization
          </h2>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap items-center p-0.5 bg-[#101216] border border-[#343B48] rounded text-xs">
          {[
            ['problem', '1. Problem Statement'],
            ['math', '2. Mathematical Formulation'],
            ['statemachines', '3. State Machines & Invariants'],
            ['markov', '4. Gilbert-Elliott Channel Model'],
            ['prior_art', '5. Prior Art & Novelty'],
            ['local_run', '6. Reproducibility Guide'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setActiveSection(key as any)}
              className={`px-3 py-1.5 rounded transition-colors text-[11px] font-semibold ${
                activeSection === key
                  ? 'bg-[#252B36] text-[#A78BFA] border border-[#A78BFA]/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section Panel */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-6 text-xs text-[#9CA3AF] leading-relaxed font-sans space-y-6 shadow-lg">
        {/* SECTION 1: PROBLEM STATEMENT */}
        {activeSection === 'problem' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#A78BFA] font-mono uppercase tracking-wider flex items-center gap-2">
              <Network className="w-4 h-4" /> 1. Problem Statement &amp; Transport Layer Bottlenecks
            </h3>
            <p className="text-sm text-[#F3F4F6] leading-relaxed">
              In conventional transport protocols, Automatic Repeat reQuest (ARQ) mechanisms operate with fixed sliding window parameters or react uniformly to packet loss regardless of whether the loss stems from isolated random bit errors (Bernoulli process) or correlated fading bursts (Gilbert-Elliott Markov process).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs pt-2">
              <div className="bg-[#101216] p-4 rounded-lg border border-[#343B48] space-y-2">
                <div className="font-bold text-[#60A5FA] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#60A5FA]" />
                  Stop-and-Wait ARQ
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  Transmits exactly 1 frame per RTT. Link utilization is mathematically bounded by:
                </p>
                <div className="p-2 bg-[#171A21] rounded text-[#A78BFA] font-mono text-[11px] text-center">
                  U = 1 / (1 + 2a), where a = T_prop / T_trans
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  Over high Bandwidth-Delay Product (BDP) links (e.g. satellite), the channel remains drastically starved.
                </p>
              </div>

              <div className="bg-[#101216] p-4 rounded-lg border border-[#343B48] space-y-2">
                <div className="font-bold text-[#FBBF24] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                  Go-Back-N ARQ
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  Allows up to W outstanding frames with cumulative ACKs. However, upon a single dropped frame, the receiver discards all subsequent out-of-order arrivals:
                </p>
                <div className="p-2 bg-[#171A21] rounded text-[#FBBF24] font-mono text-[11px] text-center">
                  Rewind cost: Retransmit [send_base ... next_seq - 1]
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  Causes catastrophic goodput collapse and bandwidth thrashing during correlated channel fades.
                </p>
              </div>

              <div className="bg-[#101216] p-4 rounded-lg border border-[#343B48] space-y-2">
                <div className="font-bold text-[#34D399] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                  Selective Repeat ARQ
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  Retransmits only missing frames using individual SACKs and out-of-order buffering:
                </p>
                <div className="p-2 bg-[#171A21] rounded text-[#34D399] font-mono text-[11px] text-center">
                  Receiver Buffer Requirement: Wr = Ws
                </div>
                <p className="text-[11px] text-[#9CA3AF] font-sans">
                  Without adaptive window throttling, fixed large windows flood deep fading channels, inducing severe bufferbloat and RTO timeouts.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: MATHEMATICAL FORMULATION */}
        {activeSection === 'math' && (
          <div className="space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-2">
              <Workflow className="w-4 h-4" /> 2. Mathematical Optimization &amp; Cost Model
            </h3>
            <p className="text-[#F3F4F6] font-sans leading-relaxed text-sm">
              AURA-BOLT computes an online multi-objective scalarization function J(w) across candidate window sizes w ∈ C at every decision epoch:
            </p>

            <div className="p-4 bg-[#101216] rounded-lg border border-[#343B48] text-[#A78BFA] text-sm leading-relaxed">
              J(w) = α · (Ĝ(w) / C_link) - β · (L̂(w) / (3 · SRTT)) - γ · (R̂(w) / w) - δ · (B̂(w) / B_max)
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-3.5 bg-[#101216] rounded-lg border border-[#343B48] space-y-2">
                <div className="font-bold text-[#F3F4F6]">Physical &amp; Protocol Safety Invariants</div>
                <ul className="list-disc pl-4 space-y-1.5 text-[#9CA3AF]">
                  <li>
                    <strong className="text-[#F3F4F6]">Receiver Buffer Invariant:</strong> w ≤ B_max (guarantees zero drop from memory exhaustion).
                  </li>
                  <li>
                    <strong className="text-[#F3F4F6]">Sequence Modulus Safety:</strong> w ≤ ⌊M / 2⌋ (prevents circular sequence aliasing across dropped packets).
                  </li>
                  <li>
                    <strong className="text-[#F3F4F6]">BDP Saturation Bound:</strong> w ≤ 2 · ⌈BDP⌉ (prevents standing queue delay and bufferbloat).
                  </li>
                </ul>
              </div>

              <div className="p-3.5 bg-[#101216] rounded-lg border border-[#343B48] space-y-2">
                <div className="font-bold text-[#F3F4F6]">Karn-Jacobson RTO Estimation</div>
                <div className="p-2 bg-[#171A21] rounded text-[#60A5FA] text-[11px]">
                  SRTT = (1 - α) · SRTT + α · RTT_sample<br />
                  RTTVAR = (1 - β) · RTTVAR + β · |SRTT - RTT_sample|<br />
                  RTO = SRTT + 4 · RTTVAR
                </div>
                <p className="text-[10px] text-[#9CA3AF] font-sans">
                  Karn's algorithm strictly excludes retransmitted frames from RTT calculations to eliminate timer ambiguity.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: STATE MACHINES */}
        {activeSection === 'statemachines' && (
          <div className="space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-2">
              <Layers className="w-4 h-4" /> 3. Sender and Receiver State Machine Invariants
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#101216] rounded-lg border border-[#343B48] space-y-3">
                <div className="font-bold text-[#34D399] uppercase">Sender State Machine</div>
                <div className="space-y-1.5 text-[11px] text-[#9CA3AF]">
                  <div>1. <strong>IDLE:</strong> Window slots available; queue holds pending application payloads.</div>
                  <div>2. <strong>TRANSMIT:</strong> Assign sequence number = next_seq; send frame; start slot timer.</div>
                  <div>3. <strong>AWAIT_ACK:</strong> Window in-flight; monitor RTO expiry queue.</div>
                  <div>4. <strong>TIMEOUT_RECOVERY:</strong> RTO expired on send_base; retransmit missing frame; backoff RTO.</div>
                </div>
              </div>

              <div className="p-4 bg-[#101216] rounded-lg border border-[#343B48] space-y-3">
                <div className="font-bold text-[#60A5FA] uppercase">Receiver State Machine</div>
                <div className="space-y-1.5 text-[11px] text-[#9CA3AF]">
                  <div>1. <strong>FRAME_ARRIVED:</strong> Verify RFC 1071 internet checksum.</div>
                  <div>2. <strong>IN_ORDER:</strong> If seq == rcv_base, deliver to application and advance window.</div>
                  <div>3. <strong>OUT_OF_ORDER:</strong> Store in SACK buffer if rcv_base &lt; seq &lt; rcv_base + Wr.</div>
                  <div>4. <strong>DUPLICATE:</strong> If seq &lt; rcv_base, re-emit ACK for rcv_base - 1 to synchronize sender.</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 4: MARKOV CHANNEL MODEL */}
        {activeSection === 'markov' && (
          <div className="space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4" /> 4. Gilbert-Elliott 2-State Markov Channel Model
            </h3>
            <p className="text-[#F3F4F6] font-sans leading-relaxed text-sm">
              Real-world wireless, satellite, and cellular channels exhibit correlated packet loss due to shadowing and multipath fading. AURA-BOLT simulates this through a discrete 2-state Markov chain:
            </p>

            <div className="p-4 bg-[#101216] rounded-lg border border-[#343B48] text-center space-y-2">
              <div className="text-sm font-bold text-[#F3F4F6]">
                [ State: GOOD (P_loss ≈ 0.001) ] &lt;=== P(G→B) === P(B→G) ===&gt; [ State: BAD (P_loss ≈ 0.95) ]
              </div>
              <div className="text-[11px] text-[#A78BFA]">
                Mean Burst Length = 1 / P(B→G) · Transmission Slot Duration
              </div>
            </div>
          </div>
        )}

        {/* SECTION 5: PRIOR ART & NOVELTY */}
        {activeSection === 'prior_art' && (
          <div className="space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" /> 5. Prior Art Review &amp; Architectural Novelty
            </h3>
            <div className="space-y-3 font-sans text-xs">
              <p className="text-[#F3F4F6]">
                Comparison with standard mechanisms (TCP Cubic, BBR, QUIC ARQ):
              </p>
              <ul className="list-disc pl-5 space-y-2 text-[#9CA3AF]">
                <li>
                  <strong className="text-[#F3F4F6]">TCP NewReno / Cubic:</strong> Treats every loss as buffer congestion, halving cwnd even during wireless fading where link capacity remains intact.
                </li>
                <li>
                  <strong className="text-[#F3F4F6]">Google BBR:</strong> Probes max bandwidth and min RTT, but relies on inflight pacing rather than explicit Markov burst-loss state discrimination at the link layer.
                </li>
                <li>
                  <strong className="text-[#F3F4F6]">AURA-BOLT Novelty:</strong> Closed-loop coupling of online burst-length detection with scalar multi-objective candidate scoring J(w), dynamically preventing cascading rewinds without wasting link capacity.
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* SECTION 6: LOCAL REPRODUCIBILITY GUIDE */}
        {activeSection === 'local_run' && (
          <div className="space-y-4 font-mono text-xs">
            <h3 className="text-sm font-bold text-[#A78BFA] uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4" /> 6. Local Reproduction &amp; Test Suite Execution
            </h3>
            <div className="p-4 bg-[#101216] rounded-lg border border-[#343B48] space-y-2">
              <div className="text-[#A78BFA] font-bold"># Execute Full Web &amp; Socket Platform</div>
              <pre className="text-[#34D399] p-2 bg-[#171A21] rounded">npm run dev</pre>
              <div className="text-[#A78BFA] font-bold mt-2"># Run TypeScript Compilation &amp; Linter</div>
              <pre className="text-[#34D399] p-2 bg-[#171A21] rounded">npm run lint</pre>
              <div className="text-[#A78BFA] font-bold mt-2"># Build Production Distribution</div>
              <pre className="text-[#34D399] p-2 bg-[#171A21] rounded">npm run build</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
