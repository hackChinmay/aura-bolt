import React, { useState } from 'react';
import { PacketFrame, WindowSlot, ExperimentConfig } from '../core/types';
import { FlyingPacketCanvas } from '../components/FlyingPacketCanvas';
import { SlidingWindowDiagram } from '../components/SlidingWindowDiagram';
import { PacketDetailModal } from '../components/PacketDetailModal';
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Filter,
  Search,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Copy,
  Sliders,
  Layers,
  ArrowRight,
  Radio,
} from 'lucide-react';

interface PacketLaboratoryProps {
  framesHistory: PacketFrame[];
  inFlightFrames: PacketFrame[];
  senderSlots: WindowSlot[];
  receiverSlots: WindowSlot[];
  config: ExperimentConfig;
  isRunning: boolean;
  onToggleRun: () => void;
  onStep: () => void;
  onReset: () => void;
  simTimeMs: number;
}

export const PacketLaboratory: React.FC<PacketLaboratoryProps> = ({
  framesHistory,
  inFlightFrames,
  senderSlots,
  receiverSlots,
  config,
  isRunning,
  onToggleRun,
  onStep,
  onReset,
  simTimeMs,
}) => {
  const [selectedFrame, setSelectedFrame] = useState<PacketFrame | null>(null);
  const [filterType, setFilterType] = useState<
    'ALL' | 'DATA' | 'ACK' | 'DROPPED' | 'RETRANSMITTED'
  >('ALL');
  const [searchSeq, setSearchSeq] = useState<string>('');

  const isFrameSuccessful = (f: PacketFrame) => f.status === 'delivered' || f.status === 'acked';
  const isFrameDropped = (f: PacketFrame) => f.status === 'lost' || f.status === 'ack_lost';
  const isFrameRetransmitted = (f: PacketFrame) => f.isRetransmission || f.retransmissionCount > 0;

  const filteredFrames = framesHistory.filter((f) => {
    if (filterType === 'DATA' && f.type !== 'DATA') return false;
    if (filterType === 'ACK' && f.type !== 'ACK') return false;
    if (filterType === 'DROPPED' && !isFrameDropped(f)) return false;
    if (filterType === 'RETRANSMITTED' && !isFrameRetransmitted(f)) return false;
    if (searchSeq !== '' && !f.seqNumber.toString().includes(searchSeq)) return false;
    return true;
  });

  const senderBase = senderSlots.length > 0 ? senderSlots[0].seqNumber : 0;
  const receiverBase = receiverSlots.length > 0 ? receiverSlots[0].seqNumber : 0;

  const totalCount = framesHistory.length;
  const deliveredCount = framesHistory.filter(isFrameSuccessful).length;
  const droppedCount = framesHistory.filter(isFrameDropped).length;
  const retransmittedCount = framesHistory.filter(isFrameRetransmitted).length;

  return (
    <div className="p-5 lg:p-6 space-y-6 overflow-y-auto select-none bg-[#101216] text-[#F3F4F6]">
      {/* Interactive Control & Live Metrics Strip */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#1D222B] border border-[#343B48] rounded-xl p-4 shadow-lg">
        {/* Playback Controls */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onToggleRun}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold font-mono rounded-lg transition-all shadow-md ${
              isRunning
                ? 'bg-[#FBBF24]/20 text-[#FBBF24] border border-[#FBBF24]/50 hover:bg-[#FBBF24]/30'
                : 'bg-[#A78BFA] text-[#101216] hover:bg-[#8B5CF6] border border-[#A78BFA]'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>PAUSE ENGINE</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>START SIMULATION</span>
              </>
            )}
          </button>

          <button
            onClick={onStep}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-mono font-medium rounded-lg bg-[#252B36] hover:bg-[#343B48] disabled:opacity-40 text-[#F3F4F6] border border-[#343B48] transition-colors"
          >
            <StepForward className="w-3.5 h-3.5 text-[#A78BFA]" />
            <span>STEP (S)</span>
          </button>

          <button
            onClick={onReset}
            className="p-2 bg-[#252B36] hover:bg-[#343B48] text-[#9CA3AF] hover:text-[#F3F4F6] rounded-lg border border-[#343B48] transition-colors"
            title="Reset Simulation State (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Live Ledger Counters */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="px-2.5 py-1 bg-[#101216] rounded border border-[#343B48] text-[#9CA3AF]">
            Clock: <span className="text-[#F3F4F6] font-bold">{Math.round(simTimeMs)} ms</span>
          </div>
          <div className="px-2.5 py-1 bg-[#101216] rounded border border-[#343B48] text-[#9CA3AF]">
            In-Flight: <span className="text-[#FBBF24] font-bold">{inFlightFrames.length}</span>
          </div>
          <div className="px-2.5 py-1 bg-[#101216] rounded border border-[#343B48] text-[#9CA3AF]">
            Delivered: <span className="text-[#34D399] font-bold">{deliveredCount}</span>
          </div>
          <div className="px-2.5 py-1 bg-[#101216] rounded border border-[#343B48] text-[#9CA3AF]">
            Dropped: <span className="text-[#FB7185] font-bold">{droppedCount}</span>
          </div>
          <div className="px-2.5 py-1 bg-[#101216] rounded border border-[#343B48] text-[#9CA3AF]">
            Retx: <span className="text-[#FBBF24] font-bold">{retransmittedCount}</span>
          </div>
        </div>
      </div>

      {/* 1. SIGNATURE NETWORK TOPOLOGY CANVAS */}
      <FlyingPacketCanvas
        inFlightFrames={inFlightFrames}
        onSelectFrame={setSelectedFrame}
        senderBase={senderBase}
        receiverBase={receiverBase}
        channelState={framesHistory.length % 7 === 0 && config.packetLossRate > 0.05 ? 'BAD' : 'GOOD'}
        oneWayDelayMs={config.oneWayDelayMs}
        lossPattern={config.lossPattern}
        bandwidthKbps={config.bandwidthKbps}
        jitterMs={config.jitterMs}
      />

      {/* 2. DEDICATED SLIDING-WINDOW & SEQUENCE RING BUFFER */}
      <SlidingWindowDiagram
        senderSlots={senderSlots}
        receiverSlots={receiverSlots}
        windowSize={config.initialWindowSize}
        protocol={config.protocol}
        seqNumberModulus={config.seqNumberModulus || 16}
      />

      {/* 3. EVENT LEDGER: HIGH-DENSITY AUDIT LOG */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
        {/* Ledger Header & Search/Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#343B48]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#A78BFA]" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#F3F4F6] font-mono">
              EVENT LEDGER &amp; PACKET AUDIT TRAIL
            </h3>
            <span className="text-xs text-[#9CA3AF] font-mono">
              ({filteredFrames.length} of {totalCount} events)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search Seq #..."
                value={searchSeq}
                onChange={(e) => setSearchSeq(e.target.value)}
                className="pl-8 pr-3 py-1 bg-[#101216] border border-[#343B48] rounded text-xs font-mono text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#A78BFA] w-36"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center p-0.5 bg-[#101216] border border-[#343B48] rounded text-xs font-mono">
              {(['ALL', 'DATA', 'ACK', 'DROPPED', 'RETRANSMITTED'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-2.5 py-1 rounded transition-colors text-[10px] font-semibold ${
                    filterType === type
                      ? 'bg-[#252B36] text-[#A78BFA] border border-[#A78BFA]/30'
                      : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dense Event Ledger Table */}
        <div className="overflow-x-auto rounded-lg border border-[#343B48]">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead className="bg-[#101216] text-[#9CA3AF] text-[10px] uppercase tracking-wider border-b border-[#343B48]">
              <tr>
                <th className="p-2.5">Time</th>
                <th className="p-2.5">Event ID</th>
                <th className="p-2.5">Type</th>
                <th className="p-2.5">Seq #</th>
                <th className="p-2.5">Ack #</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Retrans</th>
                <th className="p-2.5">Checksum</th>
                <th className="p-2.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#343B48]/50 bg-[#1D222B]">
              {filteredFrames.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-[#6B7280] italic">
                    No packet events match the current filter criteria.
                  </td>
                </tr>
              ) : (
                filteredFrames.slice(-15).reverse().map((frame) => {
                  const isAck = frame.type === 'ACK';
                  const isDropped = frame.status === 'lost' || frame.status === 'ack_lost';
                  const isRetrans = frame.isRetransmission || frame.retransmissionCount > 0;
                  return (
                    <tr
                      key={frame.id}
                      onClick={() => setSelectedFrame(frame)}
                      className="hover:bg-[#252B36]/60 cursor-pointer transition-colors"
                    >
                      <td className="p-2.5 text-[#9CA3AF] whitespace-nowrap">{frame.sentAt} ms</td>
                      <td className="p-2.5 text-[#F3F4F6] font-medium">{frame.id}</td>
                      <td className="p-2.5">
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                            isAck
                              ? 'bg-[#12352C] text-[#34D399] border border-[#34D399]/30'
                              : 'bg-[#A78BFA]/10 text-[#A78BFA] border border-[#A78BFA]/30'
                          }`}
                        >
                          {frame.type}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-[#F3F4F6]">#{frame.seqNumber}</td>
                      <td className="p-2.5 text-[#9CA3AF]">
                        {frame.ackNumber !== undefined ? `#${frame.ackNumber}` : '—'}
                      </td>
                      <td className="p-2.5">
                        <span
                          className={`font-semibold uppercase text-[10px] ${
                            isDropped
                              ? 'text-[#FB7185]'
                              : frame.status === 'acked'
                              ? 'text-[#34D399]'
                              : 'text-[#60A5FA]'
                          }`}
                        >
                          {frame.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="p-2.5">
                        {isRetrans ? (
                          <span className="text-[#FBBF24] font-bold">
                            RETX ({frame.retransmissionCount})
                          </span>
                        ) : (
                          <span className="text-[#6B7280]">0</span>
                        )}
                      </td>
                      <td className="p-2.5 text-[#A78BFA]">
                        0x{frame.checksum.toString(16).toUpperCase().padStart(4, '0')}
                      </td>
                      <td className="p-2.5 text-right">
                        <span className="text-[10px] text-[#A78BFA] hover:underline">
                          Inspect →
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Packet Inspection Slide-Out Modal */}
      {selectedFrame && (
        <PacketDetailModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
      )}
    </div>
  );
};
