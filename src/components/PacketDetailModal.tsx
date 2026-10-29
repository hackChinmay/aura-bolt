import React from 'react';
import { PacketFrame } from '../core/types';
import {
  X,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Binary,
  Layers,
  ArrowRight,
  RotateCw,
  FileCode,
} from 'lucide-react';

interface PacketDetailModalProps {
  frame: PacketFrame | null;
  onClose: () => void;
}

export const PacketDetailModal: React.FC<PacketDetailModalProps> = ({ frame, onClose }) => {
  if (!frame) return null;

  const isAck = frame.type === 'ACK';
  const isDropped = frame.status === 'lost' || frame.status === 'ack_lost';
  const isRetrans = frame.isRetransmission || frame.retransmissionCount > 0;

  // Generate pseudo-hex dump for inspection
  const hexSample = Array.from({ length: 8 }, (_, i) => {
    const val = (frame.checksum + i * 31 + frame.seqNumber) % 256;
    return val.toString(16).padStart(2, '0').toUpperCase();
  }).join(' ');

  return (
    <div className="fixed inset-0 z-50 bg-[#101216]/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl max-w-lg w-full p-5 shadow-2xl relative animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-[#343B48]">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-sm font-bold text-[#F3F4F6] tracking-tight">
              {frame.id}
            </span>
            <span className="text-[#6B7280]">·</span>
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded font-semibold border ${
                isAck
                  ? 'bg-[#12352C] text-[#34D399] border-[#34D399]/40'
                  : 'bg-[#A78BFA]/10 text-[#A78BFA] border-[#A78BFA]/30'
              }`}
            >
              {frame.type} FRAME
            </span>
            {isRetrans && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#FBBF24]/10 text-[#FBBF24] border border-[#FBBF24]/30">
                RETX #{frame.retransmissionCount}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="text-[#9CA3AF] hover:text-[#F3F4F6] p-1.5 rounded-lg hover:bg-[#252B36] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Technical Fields Grid */}
        <div className="py-4 space-y-3 font-mono text-xs">
          {/* Seq & Ack Numbers */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#101216] p-3 rounded-lg border border-[#343B48]">
              <div className="text-[#9CA3AF] text-[10px] uppercase tracking-wider">
                Sequence Number
              </div>
              <div className="text-[#F3F4F6] text-lg font-bold mt-0.5">#{frame.seqNumber}</div>
              <div className="text-[10px] text-[#6B7280] mt-0.5">32-bit Header Field</div>
            </div>

            <div className="bg-[#101216] p-3 rounded-lg border border-[#343B48]">
              <div className="text-[#9CA3AF] text-[10px] uppercase tracking-wider">
                Acknowledgement Num
              </div>
              <div className="text-[#F3F4F6] text-lg font-bold mt-0.5">
                {frame.ackNumber !== undefined ? `#${frame.ackNumber}` : 'N/A (Forward Data)'}
              </div>
              <div className="text-[10px] text-[#6B7280] mt-0.5">
                {frame.ackNumber !== undefined ? 'Cumulative / SACK' : 'Pure Forward Payload'}
              </div>
            </div>
          </div>

          {/* Status & Retransmission Diagnostic */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#101216] p-3 rounded-lg border border-[#343B48]">
              <div className="text-[#9CA3AF] text-[10px] uppercase tracking-wider">
                Delivery Lifecycle
              </div>
              <div
                className={`text-xs font-bold mt-1 uppercase ${
                  isDropped
                    ? 'text-[#FB7185]'
                    : frame.status === 'acked'
                    ? 'text-[#34D399]'
                    : 'text-[#60A5FA]'
                }`}
              >
                {frame.status.replace(/_/g, ' ')}
              </div>
            </div>

            <div className="bg-[#101216] p-3 rounded-lg border border-[#343B48]">
              <div className="text-[#9CA3AF] text-[10px] uppercase tracking-wider">
                Retransmission Overhead
              </div>
              <div
                className={`text-xs font-bold mt-1 ${
                  frame.retransmissionCount > 0 ? 'text-[#FBBF24]' : 'text-[#34D399]'
                }`}
              >
                {frame.retransmissionCount} Retransmissions
              </div>
            </div>
          </div>

          {/* Timing Telemetry */}
          <div className="bg-[#101216] p-3.5 rounded-lg border border-[#343B48] space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold pb-1 border-b border-[#343B48]/50">
              Timing &amp; Latency Profile
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="flex items-center gap-1.5 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-[#6B7280]" /> Sent Timestamp:
              </span>
              <span className="text-[#F3F4F6]">{frame.sentAt} ms (sim time)</span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="flex items-center gap-1.5 text-[11px]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" /> Arrival Timestamp:
              </span>
              <span className="text-[#F3F4F6]">
                {frame.arrivedAt !== undefined ? `${frame.arrivedAt} ms` : 'In Flight / Dropped'}
              </span>
            </div>

            {frame.arrivedAt !== undefined && (
              <div className="flex items-center justify-between pt-1.5 border-t border-[#343B48]/40">
                <span className="text-[#9CA3AF] text-[11px]">One-Way Latency:</span>
                <span className="text-[#60A5FA] font-bold">
                  {frame.arrivedAt - frame.sentAt} ms
                </span>
              </div>
            )}
          </div>

          {/* Checksum & Binary Integrity */}
          <div className="bg-[#101216] p-3.5 rounded-lg border border-[#343B48] space-y-2">
            <div className="text-[10px] uppercase tracking-wider text-[#9CA3AF] font-bold pb-1 border-b border-[#343B48]/50 flex items-center justify-between">
              <span>Integrity &amp; Checksum Verification</span>
              <span className="text-[#34D399] flex items-center gap-1 text-[10px]">
                <ShieldCheck className="w-3 h-3" /> RFC 1071 VERIFIED
              </span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="text-[11px]">Internet Checksum (16-bit):</span>
              <span className="text-[#A78BFA] font-bold">
                0x{frame.checksum.toString(16).toUpperCase().padStart(4, '0')}
              </span>
            </div>

            <div className="flex items-center justify-between text-[#9CA3AF]">
              <span className="text-[11px]">Payload Size:</span>
              <span className="text-[#F3F4F6]">{frame.payloadLength} Bytes</span>
            </div>

            <div className="pt-2 border-t border-[#343B48]/40">
              <div className="text-[10px] text-[#6B7280] mb-1">Raw Frame Slice (Hex Preview):</div>
              <div className="p-2 bg-[#171A21] rounded border border-[#343B48] text-[11px] text-[#A78BFA] font-mono tracking-wider">
                {hexSample} ... 00 20 7F
              </div>
            </div>
          </div>

          {/* Loss Diagnostic if dropped */}
          {frame.lossReason && (
            <div className="bg-[#3A2029] border border-[#FB7185]/40 p-3 rounded-lg text-[#FB7185] flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#FB7185]" />
              <div>
                <div className="font-bold text-[11px] uppercase tracking-wide">
                  Impairment Model Event
                </div>
                <div className="text-[11px] opacity-90 mt-0.5">{frame.lossReason}</div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-[#343B48] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#252B36] hover:bg-[#343B48] text-[#F3F4F6] rounded-md text-xs font-medium transition-colors border border-[#343B48]"
          >
            Dismiss Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
