import React from 'react';
import { WindowSlot } from '../core/types';

interface SlidingWindowDiagramProps {
  senderSlots: WindowSlot[];
  receiverSlots: WindowSlot[];
  windowSize: number;
  protocol: string;
}

export const SlidingWindowDiagram: React.FC<SlidingWindowDiagramProps> = ({
  senderSlots,
  receiverSlots,
  windowSize,
  protocol,
}) => {
  const getSlotStyle = (state: WindowSlot['state'], retransmissions: number) => {
    if (retransmissions > 0 && state === 'sent_unacked') {
      return 'bg-rose-950/80 border-rose-500 text-rose-300';
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
    if (retrans > 0 && state === 'sent_unacked') return 'RETX';
    switch (state) {
      case 'sent_unacked': return 'IN-FLIGHT';
      case 'acked': return 'ACKED';
      case 'buffered_out_of_order': return 'BUFFERED';
      case 'ready_to_send': return 'QUEUED';
      default: return 'IDLE';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">
      {/* Sender Window */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200 uppercase text-[11px] tracking-wider">
              Sender Sliding Window (Ws = {windowSize})
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-400 font-mono text-[11px]">
              {protocol.replace('_', ' ').toUpperCase()}
            </span>
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

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {senderSlots.length === 0 ? (
            <div className="text-xs text-slate-500 py-3 italic">
              No active frames in sender window. Start simulation to observe sliding behavior.
            </div>
          ) : (
            senderSlots.map((slot, idx) => (
              <div
                key={`snd-slot-${idx}-${slot.seqNumber}`}
                className={`min-w-16 h-14 border rounded flex flex-col items-center justify-center p-1 font-mono transition-all ${getSlotStyle(
                  slot.state,
                  slot.retransmissions
                )}`}
              >
                <span className="text-xs font-bold">Seq {slot.seqNumber}</span>
                <span className="text-[9px] mt-0.5 opacity-80">
                  {getSlotLabel(slot.state, slot.retransmissions)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Receiver Window */}
      {(protocol === 'selective_repeat' || protocol === 'aura_bolt') && (
        <div className="pt-3 border-t border-slate-800">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 uppercase text-[11px] tracking-wider">
                Receiver Sliding Buffer (Wr = {windowSize})
              </span>
              <span className="text-slate-500">·</span>
              <span className="text-purple-400 text-[11px]">Out-of-Order Buffering</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-purple-500" /> Buffered Out-of-Order
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded bg-slate-700" /> Expecting Delivery
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {receiverSlots.length === 0 ? (
              <div className="text-xs text-slate-500 py-2 italic">
                Receiver buffer empty
              </div>
            ) : (
              receiverSlots.map((slot, idx) => (
                <div
                  key={`rcv-slot-${idx}-${slot.seqNumber}`}
                  className={`min-w-16 h-12 border rounded flex flex-col items-center justify-center p-1 font-mono transition-all ${getSlotStyle(
                    slot.state,
                    0
                  )}`}
                >
                  <span className="text-xs font-bold">Seq {slot.seqNumber}</span>
                  <span className="text-[9px] mt-0.5 opacity-80">
                    {slot.state === 'buffered_out_of_order' ? 'BUFFERED' : 'WAITING'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
