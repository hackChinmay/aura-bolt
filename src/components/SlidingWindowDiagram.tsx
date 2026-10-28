import React, { useState } from 'react';
import { WindowSlot } from '../core/types';
import { Layers, ShieldCheck, AlertCircle, RefreshCw } from 'lucide-react';

interface SlidingWindowDiagramProps {
  senderSlots: WindowSlot[];
  receiverSlots: WindowSlot[];
  windowSize: number;
  protocol: string;
  seqNumberModulus?: number;
}

export const SlidingWindowDiagram: React.FC<SlidingWindowDiagramProps> = ({
  senderSlots,
  receiverSlots,
  windowSize,
  protocol,
  seqNumberModulus = 16,
}) => {
  const [viewMode, setViewMode] = useState<'linear' | 'ring'>('linear');

  const getSlotStyle = (state: WindowSlot['state'], retransmissions: number) => {
    if (retransmissions > 0 && state === 'sent_unacked') {
      return 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-sm shadow-rose-950/40';
    }
    switch (state) {
      case 'sent_unacked':
        return 'bg-amber-950/70 border-amber-500 text-amber-300';
      case 'acked':
        return 'bg-emerald-950/70 border-emerald-500 text-emerald-300';
      case 'buffered_out_of_order':
        return 'bg-purple-950/70 border-purple-400 text-purple-200';
      case 'ready_to_send':
      default:
        return 'bg-slate-900 border-slate-700 text-slate-400';
    }
  };

  const getSlotLabel = (state: WindowSlot['state'], retrans: number) => {
    if (retrans > 0 && state === 'sent_unacked') return `RETX (${retrans})`;
    switch (state) {
      case 'sent_unacked': return 'IN-FLIGHT';
      case 'acked': return 'ACKED';
      case 'buffered_out_of_order': return 'BUFFERED';
      case 'ready_to_send': return 'QUEUED';
      default: return 'IDLE';
    }
  };

  // Sender bounds
  const sendBase = senderSlots.length > 0 ? senderSlots[0].seqNumber : 0;
  const lastSent = senderSlots.length > 0 ? senderSlots[senderSlots.length - 1].seqNumber : 0;
  const rcvBase = receiverSlots.length > 0 ? receiverSlots[0].seqNumber : 0;

  // Ring buffer points calculation
  const ringSize = Math.max(16, seqNumberModulus);
  const ringSlots = Array.from({ length: ringSize }, (_, i) => {
    const seq = i;
    const senderSlot = senderSlots.find((s) => s.seqNumber % ringSize === seq);
    const receiverSlot = receiverSlots.find((r) => r.seqNumber % ringSize === seq);
    return {
      seq,
      senderSlot,
      receiverSlot,
      isInSenderWindow: senderSlots.some((s) => s.seqNumber % ringSize === seq),
      isInReceiverWindow: receiverSlots.some((r) => r.seqNumber % ringSize === seq),
    };
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-white text-xs uppercase tracking-wider">
            Sliding Window &amp; Sequence Ring Buffer
          </span>
          <span className="text-slate-500 font-mono text-xs">·</span>
          <span className="text-slate-300 font-mono text-xs">
            {protocol.replace('_', ' ').toUpperCase()} (Ws={windowSize})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono">
            <button
              onClick={() => setViewMode('linear')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'linear' ? 'bg-slate-800 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Linear Strip
            </button>
            <button
              onClick={() => setViewMode('ring')}
              className={`px-2 py-0.5 rounded transition-colors ${
                viewMode === 'ring' ? 'bg-slate-800 text-cyan-400 font-semibold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sequence Ring (Mod {ringSize})
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'linear' ? (
        <div className="space-y-4">
          {/* Sender Window Strip */}
          <div>
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-cyan-300">SENDER WINDOW:</span>
                <span>LAR = #{sendBase} (Last ACK Recv)</span>
                <span>·</span>
                <span>LFS = #{lastSent} (Last Frame Sent)</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-amber-500" /> In-Flight
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-emerald-500" /> Acknowledged
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded bg-rose-500" /> Retransmitting
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 min-h-[64px]">
              {senderSlots.length === 0 ? (
                <div className="text-xs text-slate-500 py-3 italic font-mono">
                  No frames currently in sender sliding window. Start transfer to observe sliding boundaries.
                </div>
              ) : (
                senderSlots.map((slot, idx) => (
                  <div
                    key={`snd-slot-${idx}-${slot.seqNumber}`}
                    className={`min-w-20 h-14 border rounded flex flex-col items-center justify-center p-1.5 font-mono transition-all ${getSlotStyle(
                      slot.state,
                      slot.retransmissions
                    )}`}
                  >
                    <span className="text-xs font-bold">Seq #{slot.seqNumber}</span>
                    <span className="text-[9px] mt-0.5 font-semibold">
                      {getSlotLabel(slot.state, slot.retransmissions)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Receiver Buffer Strip */}
          {(protocol === 'selective_repeat' || protocol === 'aura_bolt') && (
            <div className="pt-3 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-purple-300">RECEIVER BUFFER:</span>
                  <span>LFR = #{rcvBase} (Last Frame Recv)</span>
                  <span>·</span>
                  <span>LAF = #{rcvBase + windowSize} (Largest Acceptable)</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-purple-500" /> Buffered Out-of-Order
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded bg-slate-700" /> Expecting Next
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 min-h-[56px]">
                {receiverSlots.length === 0 ? (
                  <div className="text-xs text-slate-500 py-2 italic font-mono">
                    Receiver buffer currently empty (in-order delivery steady).
                  </div>
                ) : (
                  receiverSlots.map((slot, idx) => (
                    <div
                      key={`rcv-slot-${idx}-${slot.seqNumber}`}
                      className={`min-w-20 h-12 border rounded flex flex-col items-center justify-center p-1 font-mono transition-all ${getSlotStyle(
                        slot.state,
                        0
                      )}`}
                    >
                      <span className="text-xs font-bold">Seq #{slot.seqNumber}</span>
                      <span className="text-[9px] mt-0.5 font-semibold">
                        {slot.state === 'buffered_out_of_order' ? 'BUFFERED' : 'WAITING'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Circular Sequence Space Ring Buffer */
        <div className="flex flex-col md:flex-row items-center justify-around gap-6 py-2">
          {/* Circular SVG Diagram */}
          <div className="relative w-64 h-64 flex items-center justify-center">
            <svg viewBox="0 0 240 240" className="w-full h-full transform -rotate-90">
              {/* Background Ring Track */}
              <circle
                cx="120"
                cy="120"
                r="90"
                fill="none"
                stroke="#1e293b"
                strokeWidth="14"
              />

              {/* Slots on Ring */}
              {ringSlots.map((item, idx) => {
                const angle = (idx / ringSize) * 2 * Math.PI;
                const x = 120 + 90 * Math.cos(angle);
                const y = 120 + 90 * Math.sin(angle);

                let strokeColor = '#334155';
                if (item.senderSlot?.state === 'acked') strokeColor = '#10b981';
                else if (item.senderSlot?.retransmissions && item.senderSlot.retransmissions > 0) strokeColor = '#f43f5e';
                else if (item.senderSlot?.state === 'sent_unacked') strokeColor = '#f59e0b';
                else if (item.receiverSlot?.state === 'buffered_out_of_order') strokeColor = '#a855f7';

                return (
                  <circle
                    key={`ring-node-${idx}`}
                    cx={x}
                    cy={y}
                    r={item.isInSenderWindow ? 6 : 4}
                    fill={strokeColor}
                    stroke="#0f172a"
                    strokeWidth="2"
                  />
                );
              })}
            </svg>

            {/* Inner Ring Metadata */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center font-mono pointer-events-none">
              <span className="text-[10px] text-slate-500 uppercase">MODULUS</span>
              <span className="text-xl font-bold text-white">M = {ringSize}</span>
              <span className="text-[10px] text-cyan-400 mt-0.5">Ws ≤ ⌊M/2⌋ ({Math.floor(ringSize / 2)})</span>
            </div>
          </div>

          {/* Ring Legend & Invariant Audit */}
          <div className="space-y-3 font-mono text-xs max-w-sm">
            <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1.5">
              <div className="font-semibold text-slate-300">Modulus Arithmetic &amp; Invariants:</div>
              <p className="text-[11px] text-slate-400 leading-normal">
                To guarantee unambiguous frame delivery under out-of-order and retransmissions, Selective Repeat requires:
              </p>
              <div className="text-cyan-400 font-bold text-xs bg-slate-900 p-2 rounded border border-slate-800">
                W_sender + W_receiver ≤ M (Modulus)
              </div>
              <p className="text-[10px] text-slate-500">
                Current configuration: W_s = {windowSize}, M = {ringSize}. Status:{' '}
                {windowSize * 2 <= ringSize ? (
                  <span className="text-emerald-400 font-bold">INVARIANT SATISFIED</span>
                ) : (
                  <span className="text-amber-400 font-bold">WARNING: POTENTIAL AMBIGUITY</span>
                )}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
