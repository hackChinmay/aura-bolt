import React from 'react';
import { PacketFrame } from '../core/types';
import { X, CheckCircle, AlertTriangle, Clock, Hash, ShieldCheck, Binary } from 'lucide-react';

interface PacketDetailModalProps {
  frame: PacketFrame | null;
  onClose: () => void;
}

export const PacketDetailModal: React.FC<PacketDetailModalProps> = ({ frame, onClose }) => {
  if (!frame) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-5 shadow-2xl relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm font-mono">{frame.id}</span>
            <span className="text-slate-500">·</span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                frame.type === 'DATA'
                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              {frame.type}
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Technical Fields Grid */}
        <div className="py-4 space-y-3 font-mono text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase">Sequence Number</div>
              <div className="text-white text-base font-bold mt-0.5">#{frame.seqNumber}</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase">Acknowledgement Num</div>
              <div className="text-white text-base font-bold mt-0.5">
                {frame.ackNumber !== undefined ? `#${frame.ackNumber}` : 'N/A'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase">Frame Status</div>
              <div className="text-cyan-300 font-semibold mt-0.5 uppercase">
                {frame.status.replace('_', ' ')}
              </div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
              <div className="text-slate-400 text-[10px] uppercase">Retransmission Count</div>
              <div
                className={`font-semibold mt-0.5 ${
                  frame.retransmissionCount > 0 ? 'text-rose-400' : 'text-slate-300'
                }`}
              >
                {frame.retransmissionCount} tries ({frame.isRetransmission ? 'Retransmitted' : 'Original'})
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Transmitted At:
              </span>
              <span className="text-white">{frame.sentAt} ms (sim time)</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Delivered At:
              </span>
              <span className="text-white">
                {frame.arrivedAt ? `${frame.arrivedAt} ms` : 'In transit / Dropped'}
              </span>
            </div>

            {frame.arrivedAt && (
              <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-900">
                <span className="text-slate-300">Measured Transit Delay:</span>
                <span className="text-cyan-400 font-bold">{frame.arrivedAt - frame.sentAt} ms</span>
              </div>
            )}
          </div>

          {/* Checksum & Integrity */}
          <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> RFC 1071 Checksum:
              </span>
              <span className="text-cyan-300">0x{frame.checksum.toString(16).toUpperCase()}</span>
            </div>

            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center gap-1.5">
                <Binary className="w-3.5 h-3.5 text-slate-500" /> Payload Length:
              </span>
              <span className="text-white">{frame.payloadLength} Bytes</span>
            </div>

            {frame.payloadPreview && (
              <div className="pt-1.5 border-t border-slate-900 text-[11px] text-slate-400 truncate">
                Preview: <span className="text-slate-200">{frame.payloadPreview}</span>
              </div>
            )}
          </div>

          {/* Loss Reason if dropped */}
          {frame.lossReason && (
            <div className="bg-rose-950/50 border border-rose-500/40 p-3 rounded text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div>
                <div className="font-bold text-[11px]">Channel Drop Event</div>
                <div className="text-[11px] opacity-90">{frame.lossReason}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
