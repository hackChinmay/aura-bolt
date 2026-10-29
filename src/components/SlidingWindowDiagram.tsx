import React, { useState } from 'react';
import { WindowSlot } from '../core/types';
import { Layers, ShieldCheck, AlertCircle, RefreshCw, CircleDot } from 'lucide-react';

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
      return 'bg-[#3A2029] border-[#FB7185] text-[#FB7185] shadow-sm shadow-[#FB7185]/20';
    }
    switch (state) {
      case 'sent_unacked':
        return 'bg-[#FBBF24]/15 border-[#FBBF24] text-[#FBBF24]';
      case 'acked':
        return 'bg-[#12352C] border-[#34D399] text-[#34D399]';
      case 'buffered_out_of_order':
        return 'bg-[#60A5FA]/15 border-[#60A5FA] text-[#60A5FA]';
      case 'ready_to_send':
      default:
        return 'bg-[#101216] border-[#343B48] text-[#9CA3AF]';
    }
  };

  const getSlotLabel = (state: WindowSlot['state'], retrans: number) => {
    if (retrans > 0 && state === 'sent_unacked') return `RETX (${retrans})`;
    switch (state) {
      case 'sent_unacked':
        return 'IN-FLIGHT';
      case 'acked':
        return 'ACKED';
      case 'buffered_out_of_order':
        return 'BUFFERED';
      case 'ready_to_send':
        return 'QUEUED';
      default:
        return 'IDLE';
    }
  };

  // Sender bounds
  const sendBase = senderSlots.length > 0 ? senderSlots[0].seqNumber : 0;
  const lastSent = senderSlots.length > 0 ? senderSlots[senderSlots.length - 1].seqNumber : 0;
  const rcvBase = receiverSlots.length > 0 ? receiverSlots[0].seqNumber : 0;

  // Ring buffer calculations
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
    <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 space-y-4 shadow-lg select-none">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#343B48]">
        <div className="flex items-center gap-2.5">
          <Layers className="w-4 h-4 text-[#A78BFA]" />
          <span className="font-bold text-[#F3F4F6] text-xs uppercase tracking-wider">
            SLIDING WINDOW &amp; SEQUENCE SPACE
          </span>
          <span className="text-[#343B48] font-mono">|</span>
          <span className="text-[#A78BFA] font-mono text-xs font-semibold">
            {protocol.replace(/_/g, ' ').toUpperCase()} (Ws={windowSize})
          </span>
        </div>

        {/* View Mode Toggle: Linear Strip vs Ring */}
        <div className="flex items-center p-0.5 bg-[#101216] border border-[#343B48] rounded text-xs font-mono">
          <button
            onClick={() => setViewMode('linear')}
            className={`px-3 py-1 rounded transition-colors ${
              viewMode === 'linear'
                ? 'bg-[#252B36] text-[#A78BFA] font-semibold shadow-sm border border-[#A78BFA]/30'
                : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
            }`}
          >
            Linear Strip
          </button>
          <button
            onClick={() => setViewMode('ring')}
            className={`px-3 py-1 rounded transition-colors ${
              viewMode === 'ring'
                ? 'bg-[#252B36] text-[#A78BFA] font-semibold shadow-sm border border-[#A78BFA]/30'
                : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
            }`}
          >
            Circular Ring
          </button>
        </div>
      </div>

      {/* Mode 1: LINEAR SLIDING WINDOW STRIP */}
      {viewMode === 'linear' && (
        <div className="space-y-5">
          {/* SENDER SLIDING WINDOW */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-[#F3F4F6] font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#A78BFA]" />
                Sender Window Boundary: [Base: #{sendBase} ... Max: #{sendBase + windowSize - 1}]
              </span>
              <span className="text-[11px] text-[#9CA3AF]">
                Active Slots: {senderSlots.length} / Capacity: {windowSize}
              </span>
            </div>

            {/* Slots Track */}
            <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1.5 p-3 bg-[#101216] rounded-lg border border-[#343B48] overflow-x-auto">
              {senderSlots.map((slot) => {
                const isBase = slot.seqNumber === sendBase;
                const style = getSlotStyle(slot.state, slot.retransmissions);
                return (
                  <div
                    key={`sender-${slot.seqNumber}`}
                    className={`relative p-2 rounded border flex flex-col items-center justify-between text-center transition-all ${style}`}
                  >
                    {isBase && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#A78BFA] text-[#101216] font-bold text-[8px] font-mono px-1 rounded shadow">
                        BASE
                      </span>
                    )}
                    <span className="font-bold text-xs font-mono mt-1">#{slot.seqNumber}</span>
                    <span className="text-[8px] font-mono tracking-tight mt-1 truncate max-w-full">
                      {getSlotLabel(slot.state, slot.retransmissions)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RECEIVER BUFFER / IN-ORDER REASSEMBLY */}
          <div>
            <div className="flex items-center justify-between text-xs font-mono mb-2">
              <span className="text-[#F3F4F6] font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                Receiver Expected Sequence: #{rcvBase}
              </span>
              <span className="text-[11px] text-[#9CA3AF]">
                {protocol === 'selective_repeat' || protocol === 'aura_bolt'
                  ? 'Selective Repeat Out-of-Order Reassembly Buffer'
                  : 'In-Order Delivery SINK'}
              </span>
            </div>

            <div className="grid grid-cols-8 sm:grid-cols-12 md:grid-cols-16 gap-1.5 p-3 bg-[#101216] rounded-lg border border-[#343B48] overflow-x-auto">
              {receiverSlots.map((slot) => {
                const isExpected = slot.seqNumber === rcvBase;
                const style = getSlotStyle(slot.state, slot.retransmissions);
                return (
                  <div
                    key={`receiver-${slot.seqNumber}`}
                    className={`relative p-2 rounded border flex flex-col items-center justify-between text-center transition-all ${style}`}
                  >
                    {isExpected && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-[#34D399] text-[#101216] font-bold text-[8px] font-mono px-1 rounded shadow">
                        EXP
                      </span>
                    )}
                    <span className="font-bold text-xs font-mono mt-1">#{slot.seqNumber}</span>
                    <span className="text-[8px] font-mono tracking-tight mt-1 truncate max-w-full">
                      {getSlotLabel(slot.state, slot.retransmissions)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mode 2: CIRCULAR SEQUENCE-NUMBER RING */}
      {viewMode === 'ring' && (
        <div className="flex flex-col md:flex-row items-center justify-around gap-6 py-4 bg-[#101216] p-4 rounded-lg border border-[#343B48]">
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Center Dial Meta */}
            <div className="absolute text-center font-mono">
              <div className="text-[10px] uppercase tracking-wider text-[#9CA3AF]">Modulus</div>
              <div className="text-xl font-bold text-[#A78BFA]">M={ringSize}</div>
              <div className="text-[9px] text-[#6B7280]">Wraparound Space</div>
            </div>

            {/* Circular Ring Slots */}
            {ringSlots.map((item, index) => {
              const angle = (index / ringSize) * 2 * Math.PI - Math.PI / 2;
              const radius = 100;
              const x = 128 + radius * Math.cos(angle) - 14;
              const y = 128 + radius * Math.sin(angle) - 14;

              const isSenderBase = item.seq === sendBase % ringSize;
              const isReceiverExpected = item.seq === rcvBase % ringSize;

              let slotClass = 'bg-[#1D222B] border-[#343B48] text-[#9CA3AF]';
              if (item.senderSlot?.state === 'sent_unacked') {
                slotClass = 'bg-[#FBBF24]/20 border-[#FBBF24] text-[#FBBF24]';
              } else if (item.senderSlot?.state === 'acked') {
                slotClass = 'bg-[#12352C] border-[#34D399] text-[#34D399]';
              } else if (item.senderSlot?.state === 'buffered_out_of_order') {
                slotClass = 'bg-[#60A5FA]/20 border-[#60A5FA] text-[#60A5FA]';
              }

              return (
                <div
                  key={`ring-${item.seq}`}
                  style={{ left: `${x}px`, top: `${y}px` }}
                  className={`absolute w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-mono font-bold border transition-all ${slotClass}`}
                  title={`Seq #${item.seq} (Sender: ${
                    item.isInSenderWindow ? 'IN WINDOW' : 'OUTSIDE'
                  })`}
                >
                  {item.seq}
                  {isSenderBase && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-[#A78BFA] ring-2 ring-[#101216]" />
                  )}
                  {isReceiverExpected && (
                    <span className="absolute -bottom-1 -left-1 w-2 h-2 rounded-full bg-[#34D399] ring-2 ring-[#101216]" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Ring Legend & Diagnostic Callouts */}
          <div className="space-y-3 font-mono text-xs max-w-sm">
            <div className="text-[11px] font-bold text-[#F3F4F6] uppercase tracking-wider pb-1 border-b border-[#343B48]">
              Sequence Ring Invariants
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#A78BFA]" />
              <span className="text-[#9CA3AF]">
                Sender Base: <strong className="text-[#F3F4F6]">#{sendBase}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
              <span className="text-[#9CA3AF]">
                Receiver Expected: <strong className="text-[#F3F4F6]">#{rcvBase}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
              <span className="text-[#9CA3AF]">In-Flight Unacknowledged Frames</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#60A5FA]" />
              <span className="text-[#9CA3AF]">Out-of-Order Buffered at Receiver</span>
            </div>
            <div className="p-2.5 bg-[#1D222B] rounded border border-[#343B48] text-[10px] text-[#9CA3AF] leading-relaxed">
              Window Safety Invariant:{' '}
              <span className="text-[#A78BFA] font-bold">
                Ws ≤ ⌊M / 2⌋ = {Math.floor(ringSize / 2)}
              </span>{' '}
              to prevent sequence number aliasing across packet losses.
            </div>
          </div>
        </div>
      )}

      {/* Bottom Color Semantic Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] font-mono border-t border-[#343B48]/50 text-[#9CA3AF]">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-[#34D399]" /> Acked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-[#FBBF24]" /> In-Flight
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-[#FB7185]" /> Retransmitted
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-[#60A5FA]" /> SACK Buffered
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded bg-[#343B48]" /> Idle
          </span>
        </div>
        <div className="text-[10px] text-[#6B7280]">
          Updates in real-time with discrete simulation engine
        </div>
      </div>
    </div>
  );
};
