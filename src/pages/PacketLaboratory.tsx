import React, { useState } from 'react';
import { PacketFrame, WindowSlot, ExperimentConfig } from '../core/types';
import { FlyingPacketCanvas } from '../components/FlyingPacketCanvas';
import { SlidingWindowDiagram } from '../components/SlidingWindowDiagram';
import { PacketDetailModal } from '../components/PacketDetailModal';
import { Play, Pause, StepForward, RotateCcw, Filter, Search } from 'lucide-react';

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
  const [filterType, setFilterType] = useState<'ALL' | 'DATA' | 'ACK' | 'LOST'>('ALL');
  const [searchSeq, setSearchSeq] = useState<string>('');

  const filteredFrames = framesHistory.filter((f) => {
    if (filterType === 'DATA' && f.type !== 'DATA') return false;
    if (filterType === 'ACK' && f.type !== 'ACK') return false;
    if (filterType === 'LOST' && f.status !== 'lost' && f.status !== 'ack_lost') return false;
    if (searchSeq !== '' && !f.seqNumber.toString().includes(searchSeq)) return false;
    return true;
  });

  const senderBase = senderSlots.length > 0 ? senderSlots[0].seqNumber : 0;
  const receiverBase = receiverSlots.length > 0 ? receiverSlots[0].seqNumber : 0;

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded p-4">
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
                <span>Pause Stream</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>Resume Stream</span>
              </>
            )}
          </button>

          <button
            onClick={onStep}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 border border-slate-700 transition-colors"
          >
            <StepForward className="w-3.5 h-3.5" />
            <span>Step Event</span>
          </button>

          <button
            onClick={onReset}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors"
            title="Reset"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-slate-400">
            Sim Clock: <span className="text-white font-bold">{Math.round(simTimeMs)} ms</span>
          </div>
          <div className="text-slate-500">·</div>
          <div className="text-slate-400">
            Recorded Events: <span className="text-cyan-400 font-bold">{framesHistory.length}</span>
          </div>
          <div className="text-slate-500">·</div>
          <div className="text-slate-400">
            In-Flight: <span className="text-amber-400 font-bold">{inFlightFrames.length}</span>
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

      {/* Sliding Window Diagrams */}
      <SlidingWindowDiagram
        senderSlots={senderSlots}
        receiverSlots={receiverSlots}
        windowSize={config.initialWindowSize}
        protocol={config.protocol}
      />

      {/* Packet Events Audit Table */}
      <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold text-white">Packet Events Ledger</h3>
            <p className="text-xs text-slate-400">
              Click any row to inspect complete packet header, RFC 1071 checksum, and loss diagnostics.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Filter buttons */}
            <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded">
              {(['ALL', 'DATA', 'ACK', 'LOST'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setFilterType(mode)}
                  className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                    filterType === mode
                      ? 'bg-slate-800 text-cyan-400 font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {mode}
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

        {/* Table */}
        <div className="overflow-x-auto max-h-72">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 sticky top-0">
              <tr>
                <th className="py-2 px-3">Frame ID</th>
                <th className="py-2 px-3">Type</th>
                <th className="py-2 px-3">Seq #</th>
                <th className="py-2 px-3">Ack #</th>
                <th className="py-2 px-3">Sent At</th>
                <th className="py-2 px-3">Delivered At</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Retx</th>
                <th className="py-2 px-3">Loss Diagnostics</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredFrames.slice(-40).reverse().map((frame) => (
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
                  <td className="py-2 px-3">
                    <span
                      className={`uppercase text-[10px] font-bold ${
                        frame.status === 'delivered' || frame.status === 'acked'
                          ? 'text-emerald-400'
                          : frame.status === 'lost' || frame.status === 'ack_lost'
                          ? 'text-rose-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {frame.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-400">
                    {frame.retransmissionCount > 0 ? (
                      <span className="text-rose-400 font-bold">{frame.retransmissionCount}</span>
                    ) : (
                      '0'
                    )}
                  </td>
                  <td className="py-2 px-3 text-[11px] text-slate-400 truncate max-w-xs">
                    {frame.lossReason ?? '-'}
                  </td>
                </tr>
              ))}
              {filteredFrames.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-slate-500 italic">
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
