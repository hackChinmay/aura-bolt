import React from 'react';
import { PacketFrame } from '../core/types';
import {
  ArrowRight,
  ArrowLeft,
  ShieldAlert,
  Server,
  Activity,
  Zap,
  Radio,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';

interface FlyingPacketCanvasProps {
  inFlightFrames: PacketFrame[];
  onSelectFrame: (frame: PacketFrame) => void;
  senderBase: number;
  receiverBase: number;
  channelState: 'GOOD' | 'BAD';
  oneWayDelayMs: number;
  lossPattern: string;
  bandwidthKbps?: number;
  jitterMs?: number;
}

export const FlyingPacketCanvas: React.FC<FlyingPacketCanvasProps> = ({
  inFlightFrames,
  onSelectFrame,
  senderBase,
  receiverBase,
  channelState,
  oneWayDelayMs,
  lossPattern,
  bandwidthKbps = 5000,
  jitterMs = 2,
}) => {
  const forwardDataFrames = inFlightFrames.filter(
    (f) => f.direction === 'sender_to_receiver' && f.type === 'DATA'
  );
  const reverseAckFrames = inFlightFrames.filter(
    (f) => f.direction === 'receiver_to_sender' || f.type === 'ACK'
  );

  return (
    <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 relative overflow-hidden shadow-lg select-none">
      {/* Channel Header Bar / Inspector Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono pb-3.5 mb-5 border-b border-[#343B48]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[#F3F4F6] font-semibold tracking-wide">
            <Radio className="w-4 h-4 text-[#A78BFA]" />
            <span>CHANNEL TOPOLOGY INSPECTOR</span>
          </div>
          <span className="text-[#343B48]">|</span>
          <span className="text-[#9CA3AF]">
            Delay: <span className="text-[#60A5FA] font-bold">{oneWayDelayMs} ms</span> (±{jitterMs} ms jitter)
          </span>
          <span className="text-[#343B48]">|</span>
          <span className="text-[#9CA3AF]">
            Bandwidth: <span className="text-[#F3F4F6] font-bold">{bandwidthKbps} Kbps</span>
          </span>
        </div>

        {/* Gilbert-Elliott Markov State Indicator */}
        <div className="flex items-center gap-2">
          <span className="text-[#9CA3AF] text-[11px]">Markov State:</span>
          <span
            className={`px-2.5 py-1 text-[10px] font-bold font-mono rounded-md tracking-wider flex items-center gap-1.5 border transition-all ${
              channelState === 'GOOD'
                ? 'bg-[#12352C] text-[#34D399] border-[#34D399]/40'
                : 'bg-[#3A2029] text-[#FB7185] border-[#FB7185]/40 animate-pulse'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                channelState === 'GOOD' ? 'bg-[#34D399]' : 'bg-[#FB7185]'
              }`}
            />
            {channelState === 'GOOD' ? 'GOOD (CLEAR CHANNEL)' : 'BAD (BURST LOSS FADE)'}
          </span>
        </div>
      </div>

      {/* Main Network Topology Grid */}
      <div className="grid grid-cols-12 gap-5 items-stretch min-h-[240px]">
        {/* SENDER NODE (Cols 1-3) */}
        <div className="col-span-12 md:col-span-3 bg-[#101216] border border-[#343B48] rounded-lg p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#A78BFA]" />
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-[#F3F4F6] tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#A78BFA]" />
                SENDER NODE (TX)
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#252B36] text-[#A78BFA] border border-[#343B48]">
                UDP:19001
              </span>
            </div>
            <div className="text-[11px] text-[#9CA3AF]">Reliable Sliding Window Agent</div>
          </div>

          <div className="my-3 space-y-2 text-xs font-mono bg-[#1D222B] p-3 rounded-md border border-[#343B48]/60">
            <div className="flex justify-between items-center text-[#9CA3AF]">
              <span>Send Base:</span>
              <span className="text-[#F3F4F6] font-bold">#{senderBase}</span>
            </div>
            <div className="flex justify-between items-center text-[#9CA3AF]">
              <span>TX Buffer:</span>
              <span className="text-[#34D399] font-medium">READY</span>
            </div>
            <div className="flex justify-between items-center text-[#9CA3AF]">
              <span>RFC 1071:</span>
              <span className="text-[#A78BFA] font-medium">Enabled</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#A78BFA] pt-2 border-t border-[#343B48]/40">
            <span className="flex items-center gap-1">
              Forward Channel <ArrowRight className="w-3 h-3" />
            </span>
            <span className="text-[10px] text-[#9CA3AF]">TX Queue</span>
          </div>
        </div>

        {/* TRANSIT DUAL-CHANNEL CANVAS (Cols 4-9) */}
        <div className="col-span-12 md:col-span-6 relative border border-[#343B48] rounded-lg bg-[#101216]/60 flex flex-col justify-between p-3.5 overflow-hidden shadow-inner">
          {/* Forward Link Track (DATA FRAMES) */}
          <div className="w-full relative h-24 border-b border-dashed border-[#343B48] flex flex-col justify-between pb-1.5">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9CA3AF] font-mono">
              <span className="flex items-center gap-1.5 text-[#A78BFA]">
                <ArrowRight className="w-3 h-3" /> Forward Link: Data Frames (TX → RX)
              </span>
              <span className="text-[#6B7280]">
                {forwardDataFrames.length} in transit
              </span>
            </div>

            {/* Visual Motion Track for DATA */}
            <div className="w-full relative flex items-center justify-around gap-2 px-2 py-1 min-h-[48px]">
              {forwardDataFrames.length === 0 ? (
                <div className="text-[11px] font-mono text-[#6B7280] italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280]" />
                  Channel Idle / Waiting for next transmission epoch
                </div>
              ) : (
                forwardDataFrames.slice(-6).map((frame) => {
                  const isRetrans = frame.isRetransmission || frame.retransmissionCount > 0;
                  return (
                    <button
                      key={frame.id}
                      onClick={() => onSelectFrame(frame)}
                      className={`group relative flex flex-col items-center px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all transform hover:scale-110 shadow-md ${
                        isRetrans
                          ? 'bg-[#FBBF24]/15 border-[#FBBF24] text-[#FBBF24]'
                          : 'bg-[#A78BFA]/15 border-[#A78BFA] text-[#A78BFA]'
                      }`}
                    >
                      <span className="font-bold text-[11px]">DATA #{frame.seqNumber}</span>
                      <span className="text-[9px] opacity-80">
                        {isRetrans ? `RETX (${frame.retransmissionCount})` : `${frame.payloadLength}B`}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Reverse Link Track (ACK / NACK MESSAGES) */}
          <div className="w-full relative h-24 flex flex-col justify-between pt-1.5">
            {/* Visual Motion Track for ACKs */}
            <div className="w-full relative flex items-center justify-around gap-2 px-2 py-1 min-h-[48px]">
              {reverseAckFrames.length === 0 ? (
                <div className="text-[11px] font-mono text-[#6B7280] italic flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6B7280]" />
                  Reverse ACK channel clear
                </div>
              ) : (
                reverseAckFrames.slice(-6).map((frame) => (
                  <button
                    key={frame.id}
                    onClick={() => onSelectFrame(frame)}
                    className="group relative flex flex-col items-center px-2.5 py-1.5 rounded-md text-xs font-mono bg-[#12352C] border border-[#343B48] text-[#34D399] transition-all transform hover:scale-110 shadow-md"
                  >
                    <span className="font-bold text-[11px]">
                      ACK #{frame.ackNumber !== undefined ? frame.ackNumber : frame.seqNumber}
                    </span>
                    <span className="text-[9px] text-[#34D399]/80 font-mono">Verified</span>
                  </button>
                ))
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-[#9CA3AF] font-mono">
              <span className="flex items-center gap-1.5 text-[#34D399]">
                <ArrowLeft className="w-3 h-3" /> Reverse Link: Acknowledgements (RX → TX)
              </span>
              <span className="text-[#6B7280]">
                {reverseAckFrames.length} in transit
              </span>
            </div>
          </div>
        </div>

        {/* RECEIVER NODE (Cols 10-12) */}
        <div className="col-span-12 md:col-span-3 bg-[#101216] border border-[#343B48] rounded-lg p-4 flex flex-col justify-between shadow-md relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-[#34D399]" />
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-bold text-[#F3F4F6] tracking-wider flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#34D399]" />
                RECEIVER NODE (RX)
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#252B36] text-[#34D399] border border-[#343B48]">
                UDP:19002
              </span>
            </div>
            <div className="text-[11px] text-[#9CA3AF]">In-Order SINK &amp; Reassembly Buffer</div>
          </div>

          <div className="my-3 space-y-2 text-xs font-mono bg-[#1D222B] p-3 rounded-md border border-[#343B48]/60">
            <div className="flex justify-between items-center text-[#9CA3AF]">
              <span>Rcv Expected:</span>
              <span className="text-[#34D399] font-bold">#{receiverBase}</span>
            </div>
            <div className="flex justify-between items-center text-[#9CA3AF]">
              <span>RX Integrity:</span>
              <span className="text-[#34D399] font-medium">100% SHA-256</span>
            </div>
            <div className="flex justify-between items-center text-[#9CA3AF]">
              <span>SACK Support:</span>
              <span className="text-[#60A5FA] font-medium">RFC 2018</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-[#34D399] pt-2 border-t border-[#343B48]/40">
            <span className="flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Reverse ACK
            </span>
            <span className="text-[10px] text-[#9CA3AF]">Cumulative ACK</span>
          </div>
        </div>
      </div>
    </div>
  );
};
