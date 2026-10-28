import React, { useState } from 'react';
import { PacketFrame, WindowSlot, ExperimentConfig } from '../core/types';
import { FlyingPacketCanvas } from '../components/FlyingPacketCanvas';
import { SlidingWindowDiagram } from '../components/SlidingWindowDiagram';
import { PacketDetailModal } from '../components/PacketDetailModal';
import { Play, Pause, StepForward, RotateCcw, Filter, Search, CheckCircle2, AlertOctagon, RotateCw, Copy } from 'lucide-react';

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
    'ALL' | 'SUCCESSFUL' | 'DROPPED' | 'RETRANSMITTED' | 'DUPLICATE' | 'ACK'
  >('ALL');
  const [searchSeq, setSearchSeq] = useState<string>('');

  // Status mapping
  const isFrameSuccessful = (f: PacketFrame) => f.status === 'delivered' || f.status === 'acked';
  const isFrameDropped = (f: PacketFrame) => f.status === 'lost' || f.status === 'ack_lost';
  const isFrameRetransmitted = (f: PacketFrame) => f.isRetransmission || f.retransmissionCount > 0;
  const isFrameDuplicate = (f: PacketFrame) => f.status === 'rejected' || (f.isRetransmission && f.status === 'delivered');

  const filteredFrames = framesHistory.filter((f) => {
    if (filterType === 'SUCCESSFUL' && !isFrameSuccessful(f)) return false;
    if (filterType === 'DROPPED' && !isFrameDropped(f)) return false;
    if (filterType === 'RETRANSMITTED' && !isFrameRetransmitted(f)) return false;
    if (filterType === 'DUPLICATE' && !isFrameDuplicate(f)) return false;
    if (filterType === 'ACK' && f.type !== 'ACK') return false;
    if (searchSeq !== '' && !f.seqNumber.toString().includes(searchSeq)) return false;
    return true;
  });

  const senderBase = senderSlots.length > 0 ? senderSlots[0].seqNumber : 0;
  const receiverBase = receiverSlots.length > 0 ? receiverSlots[0].seqNumber : 0;

  // Counts for top summary
  const totalCount = framesHistory.length;
  const successfulCount = framesHistory.filter(isFrameSuccessful).length;
  const droppedCount = framesHistory.filter(isFrameDropped).length;
  const retransmittedCount = framesHistory.filter(isFrameRetransmitted).length;
  const duplicateCount = framesHistory.filter(isFrameDuplicate).length;

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Control Toolbar & Summary Indicators */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded p-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleRun}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded text-white transition-colors ${
              isRunning ? 'bg-amber-600 hover:bg-amber-500' : 'bg-cyan-600 hover:bg-cyan-500'
            }`}
          >
            {isRunning ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Engine</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Run Simulation</span>
              </>
            )}
          </button>

          <button
            onClick={onStep}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>Single Step Event</span>
          </button>

          <button
            onClick={onReset}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            title="Reset Simulation Engine"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="text-slate-400">
            Clock: <span className="text-white font-bold">{Math.round(simTimeMs)} ms</span>
          </div>
          <div className="text-slate-600">·</div>
          <div className="text-slate-400">
            In-Flight: <span className="text-amber-400 font-bold">{inFlightFrames.length}</span>
          </div>
          <div className="text-slate-600">·</div>
          <div className="text-slate-400">
            Delivered: <span className="text-emerald-400 font-bold">{successfulCount}</span>
          </div>
          <div className="text-slate-600">·</div>
          <div className="text-slate-400">
            Dropped: <span className="text-rose-400 font-bold">{droppedCount}</span>
          </div>
          <div className="text-slate-600">·</div>
          <div className="text-slate-400">
            Retrans: <span className="text-rose-300 font-bold">{retransmittedCount}</span>
          </div>
        </div>
      </div>

      {/* Network Channel Canvas */}
      <FlyingPacketCanvas
        inFlightFrames={inFlightFrames}
        onSelectFrame={(f) => setSelectedFrame(f)}
        senderBase={senderBase}
        receiverBase={receiverBase}
        channelState="GOOD"
        oneWayDelayMs={config.oneWayDelayMs}
        lossPattern={config.lossPattern}
      />

      {/* Sliding Window Diagrams with Modulus Ring Option */}
      <SlidingWindowDiagram
        senderSlots={senderSlots}
        receiverSlots={receiverSlots}
        windowSize={config.initialWindowSize}
        protocol={config.protocol}
        seqNumberModulus={config.seqNumberModulus}
      />

      {/* Packet Events Audit Ledger */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Recorded Packet Events Ledger</h3>
            <p className="text-xs text-slate-400">
              Audit trail distinguishing successful deliveries, dropped frames, duplicates, and retransmissions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono">
              {(
                [
                  { id: 'ALL', label: 'All' },
                  { id: 'SUCCESSFUL', label: 'Delivered' },
                  { id: 'DROPPED', label: 'Dropped' },
                  { id: 'RETRANSMITTED', label: 'Retx' },
                  { id: 'DUPLICATE', label: 'Duplicate' },
                  { id: 'ACK', label: 'ACKs' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setFilterType(mode.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    filterType === mode.id
                      ? 'bg-slate-800 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>

            {/* Sequence Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Seq #..."
                value={searchSeq}
                onChange={(e) => setSearchSeq(e.target.value)}
                className="w-24 px-2 py-1 bg-slate-950 border border-slate-800 rounded text-xs text-white placeholder-slate-500 font-mono focus:outline-hidden focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Ledger Table */}
        <div className="overflow-x-auto max-h-80">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2 px-3">Frame ID</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Seq #</th>
                <th className="py-2 px-3">Ack #</th>
                <th className="py-2 px-3">Sent At</th>
                <th className="py-2 px-3">Delivered At</th>
                <th className="py-2 px-3">Transit RTT</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Retx Count</th>
                <th className="py-2 px-3">RFC 1071 Checksum</th>
                <th className="py-2 px-3">Loss Diagnostics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredFrames.slice(-60).reverse().map((frame) => {
                const isDropped = isFrameDropped(frame);
                const isSuccess = isFrameSuccessful(frame);
                const isRetrans = isFrameRetransmitted(frame);
                const isDup = isFrameDuplicate(frame);

                return (
                  <tr
                    key={frame.id}
                    onClick={() => setSelectedFrame(frame)}
                    className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 text-cyan-300 font-semibold">{frame.id}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          frame.type === 'DATA'
                            ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30'
                            : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {frame.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white font-bold">#{frame.seqNumber}</td>
                    <td className="py-2 px-3 text-slate-400">
                      {frame.ackNumber !== undefined ? `#${frame.ackNumber}` : '-'}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{Math.round(frame.sentAt)}ms</td>
                    <td className="py-2 px-3 text-slate-400">
                      {frame.arrivedAt ? `${Math.round(frame.arrivedAt)}ms` : '-'}
                    </td>
                    <td className="py-2 px-3 text-cyan-400">
                      {frame.arrivedAt ? `${Math.round(frame.arrivedAt - frame.sentAt)}ms` : '-'}
                    </td>
                    <td className="py-2 px-3">
                      {isDropped && (
                        <span className="text-rose-400 font-bold uppercase text-[10px] bg-rose-950/60 border border-rose-800/50 px-1.5 py-0.5 rounded">
                          DROPPED
                        </span>
                      )}
                      {!isDropped && isDup && (
                        <span className="text-amber-400 font-bold uppercase text-[10px] bg-amber-950/60 border border-amber-800/50 px-1.5 py-0.5 rounded">
                          DUPLICATE
                        </span>
                      )}
                      {!isDropped && !isDup && isSuccess && (
                        <span className="text-emerald-400 font-bold uppercase text-[10px] bg-emerald-950/60 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                          DELIVERED
                        </span>
                      )}
                      {!isDropped && !isDup && !isSuccess && (
                        <span className="text-slate-400 font-bold uppercase text-[10px]">
                          {frame.status.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      {frame.retransmissionCount > 0 ? (
                        <span className="text-rose-400 font-bold">
                          {frame.retransmissionCount} (Retx)
                        </span>
                      ) : (
                        <span className="text-slate-500">0</span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      0x{frame.checksum.toString(16).toUpperCase()}
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-400 truncate max-w-xs">
                      {frame.lossReason ?? '-'}
                    </td>
                  </tr>
                );
              })}
              {filteredFrames.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-8 text-center text-slate-500 italic">
                    No packet events match filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Packet Modal */}
      <PacketDetailModal frame={selectedFrame} onClose={() => setSelectedFrame(null)} />
    </div>
  );
};
