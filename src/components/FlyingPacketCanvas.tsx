import React from 'react';
import { PacketFrame } from '../core/types';
import { ArrowRight, ArrowLeft, ShieldAlert } from 'lucide-react';

interface FlyingPacketCanvasProps {
  inFlightFrames: PacketFrame[];
  onSelectFrame: (frame: PacketFrame) => void;
  senderBase: number;
  receiverBase: number;
  channelState: 'GOOD' | 'BAD';
  oneWayDelayMs: number;
  lossPattern: string;
}

export const FlyingPacketCanvas: React.FC<FlyingPacketCanvasProps> = ({
  inFlightFrames,
  onSelectFrame,
  senderBase,
  receiverBase,
  channelState,
  oneWayDelayMs,
  lossPattern,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded p-5 relative overflow-hidden">
      {/* Channel Header Bar */}
      <div className="flex items-center justify-between text-xs text-slate-400 mb-6 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">PHYSICAL CHANNEL MODEL</span>
          <span>·</span>
          <span>Delay: {oneWayDelayMs}ms</span>
          <span>·</span>
          <span className="capitalize">{lossPattern.replace('_', ' ')}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400 text-[11px]">Gilbert-Elliott State:</span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold rounded ${
              channelState === 'GOOD'
                ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-950 text-rose-400 border border-rose-500/30 animate-pulse'
            }`}
          >
            {channelState === 'GOOD' ? 'STATE: GOOD (CLEAR)' : 'STATE: BAD (BURST FADE)'}
          </span>
        </div>
      </div>

      {/* Network Nodes Grid */}
      <div className="grid grid-cols-12 gap-4 items-center min-h-[220px]">
        {/* SENDER NODE (Cols 1-3) */}
        <div className="col-span-3 bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-between h-48 shadow-lg">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-white tracking-wide">SENDER NODE</span>
              <span className="text-cyan-400 text-[10px] font-mono">TX</span>
            </div>
            <div className="text-[11px] text-slate-400">Host: 127.0.0.1:19001</div>
          </div>

          <div className="space-y-1.5 text-xs font-mono bg-slate-900/80 p-2.5 rounded border border-slate-800/80">
            <div className="text-slate-400 flex justify-between">
              <span>Send Base:</span>
              <span className="text-white font-semibold">#{senderBase}</span>
            </div>
            <div className="text-slate-400 flex justify-between">
              <span>TX State:</span>
              <span className="text-emerald-400">ACTIVE</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-cyan-400">
            <ArrowRight className="w-3.5 h-3.5" />
            <span>Forward Data Channel</span>
          </div>
        </div>

        {/* TRANSIT CHANNEL CANVAS (Cols 4-9) */}
        <div className="col-span-6 relative h-48 border border-dashed border-slate-800 rounded bg-slate-950/40 flex flex-col justify-between p-3 overflow-hidden">
          {/* Forward Track (DATA) */}
          <div className="w-full relative h-16 border-b border-slate-800/60 flex items-center">
            <div className="absolute top-1 left-2 text-[9px] uppercase tracking-wider text-slate-400 font-mono">
              Forward Link: Data Frames (Tx -&gt; Rx)
            </div>

            {/* In-Flight Data Frames */}
            <div className="w-full flex items-center justify-around gap-2 px-4 z-10">
              {inFlightFrames
                .filter((f) => f.direction === 'sender_to_receiver')
                .slice(-5)
                .map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => onSelectFrame(frame)}
                    className="group relative flex flex-col items-center bg-cyan-950 border border-cyan-500 text-cyan-300 rounded px-2.5 py-1.5 text-xs font-mono shadow-md hover:scale-105 transition-all"
                  >
                    <span className="font-bold text-[11px]">DATA #{frame.seqNumber}</span>
                    <span className="text-[9px] text-cyan-400 opacity-80">
                      {frame.isRetransmission ? 'Retransmit' : '1024 B'}
                    </span>
                  </button>
                ))}
              {inFlightFrames.filter((f) => f.direction === 'sender_to_receiver').length === 0 && (
                <span className="text-xs text-slate-500 italic">No data frames currently in transit</span>
              )}
            </div>
          </div>

          {/* Reverse Track (ACK) */}
          <div className="w-full relative h-16 flex items-center">
            <div className="absolute bottom-1 right-2 text-[9px] uppercase tracking-wider text-slate-400 font-mono">
              Reverse Link: ACKs (Rx -&gt; Tx)
            </div>

            {/* In-Flight ACKs */}
            <div className="w-full flex items-center justify-around gap-2 px-4 z-10">
              {inFlightFrames
                .filter((f) => f.direction === 'receiver_to_sender')
                .slice(-5)
                .map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => onSelectFrame(frame)}
                    className="group relative flex flex-col items-center bg-emerald-950 border border-emerald-500 text-emerald-300 rounded px-2.5 py-1.5 text-xs font-mono shadow-md hover:scale-105 transition-all"
                  >
                    <span className="font-bold text-[11px]">ACK #{frame.ackNumber ?? frame.seqNumber}</span>
                    <span className="text-[9px] text-emerald-400 opacity-80">Control</span>
                  </button>
                ))}
              {inFlightFrames.filter((f) => f.direction === 'receiver_to_sender').length === 0 && (
                <span className="text-xs text-slate-500 italic">No ACKs currently in transit</span>
              )}
            </div>
          </div>
        </div>

        {/* RECEIVER NODE (Cols 10-12) */}
        <div className="col-span-3 bg-slate-950 border border-slate-800 rounded p-4 flex flex-col justify-between h-48 shadow-lg">
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-white tracking-wide">RECEIVER NODE</span>
              <span className="text-emerald-400 text-[10px] font-mono">RX</span>
            </div>
            <div className="text-[11px] text-slate-400">Host: 127.0.0.1:19002</div>
          </div>

          <div className="space-y-1.5 text-xs font-mono bg-slate-900/80 p-2.5 rounded border border-slate-800/80">
            <div className="text-slate-400 flex justify-between">
              <span>Expected Seq:</span>
              <span className="text-white font-semibold">#{receiverBase}</span>
            </div>
            <div className="text-slate-400 flex justify-between">
              <span>Integrity:</span>
              <span className="text-emerald-400">SHA-256 VALID</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Reverse ACK Channel</span>
          </div>
        </div>
      </div>
    </div>
  );
};
