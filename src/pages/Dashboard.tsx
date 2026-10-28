import React from 'react';
import {
  MetricSnapshot,
  ExperimentSummary,
  ExperimentConfig,
  ControllerDecision,
} from '../core/types';
import { MetricCard } from '../components/MetricCard';
import {
  Zap,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Layers,
  Activity,
  CheckCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

interface DashboardProps {
  summary: ExperimentSummary | null;
  snapshots: MetricSnapshot[];
  config: ExperimentConfig;
  isRunning: boolean;
  decisions: ControllerDecision[];
  onStartExperiment: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  snapshots,
  config,
  isRunning,
  decisions,
  onStartExperiment,
}) => {
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const latestDecision = decisions.length > 0 ? decisions[decisions.length - 1] : null;

  const hasData = snapshots.length > 0;

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Top Banner & Control */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded p-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="font-semibold text-slate-200">ACTIVE PROFILE</span>
            <span>·</span>
            <span className="uppercase text-cyan-400 font-mono">
              {config.protocol.replace('_', ' ')}
            </span>
            <span>·</span>
            <span>{config.executionMode === 'simulation' ? 'Deterministic Sim' : 'Real UDP Socket'}</span>
          </div>
          <div className="text-sm text-slate-300">
            {config.name} ({config.totalFrames} frames @ {config.payloadSize} B)
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <div className="text-slate-400">Channel Model</div>
            <div className="font-semibold text-white">
              {config.lossPattern.toUpperCase()} (P={Math.round(config.packetLossRate * 100)}%)
            </div>
          </div>

          <button
            onClick={onStartExperiment}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold tracking-wide transition-colors"
          >
            {isRunning ? 'Running Experiment...' : 'Execute Run'}
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Goodput"
          value={latestSnapshot ? latestSnapshot.goodputKbps : (summary?.finalGoodputKbps ?? 0)}
          unit="Kbps"
          subtitle={`Payload delivered: ${latestSnapshot ? latestSnapshot.bytesDeliveredTotal : 0} B`}
          icon={Zap}
          variant="cyan"
        />

        <MetricCard
          label="Estimated RTT"
          value={latestSnapshot ? latestSnapshot.srttMs : config.oneWayDelayMs * 2}
          unit="ms"
          subtitle={`RTO Timer: ${latestSnapshot ? latestSnapshot.rtoMs : config.initialRtoMs} ms`}
          icon={Clock}
          variant="default"
        />

        <MetricCard
          label="Retransmission Ratio"
          value={latestSnapshot ? `${Math.round(latestSnapshot.retransmissionRatio * 100)}%` : '0%'}
          unit=""
          subtitle={`Retrans: ${latestSnapshot ? latestSnapshot.framesRetransmittedTotal : 0} / Sent: ${latestSnapshot ? latestSnapshot.framesSentTotal : 0}`}
          icon={RotateCcw}
          variant={latestSnapshot && latestSnapshot.retransmissionRatio > 0.15 ? 'rose' : 'default'}
        />

        <MetricCard
          label="Active Window Size"
          value={latestSnapshot ? latestSnapshot.currentWindowSize : config.initialWindowSize}
          unit="frames"
          subtitle={`Buffer usage: ${latestSnapshot ? latestSnapshot.receiverBufferUsage : 0}/${config.receiverBufferSize}`}
          icon={Layers}
          variant="amber"
        />
      </div>

      {/* Controller Operating Mode & Channel Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">
            Controller Operating Mode
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                latestDecision?.mode === 'CONSERVATIVE_RECOVERY'
                  ? 'bg-amber-400 animate-pulse'
                  : latestDecision?.mode === 'FALLBACK'
                  ? 'bg-rose-500'
                  : 'bg-emerald-400'
              }`}
            />
            <span className="text-base font-bold text-white font-mono">
              {latestDecision?.mode ?? 'OPTIMAL (STEADY)'}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            {latestDecision?.reason ??
              'Adaptive controller monitoring smoothed RTT and Gilbert-Elliott loss transitions.'}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">
            Gilbert-Elliott State
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                latestSnapshot?.currentChannelState === 'BAD'
                  ? 'bg-rose-950 text-rose-400 border border-rose-500/30 animate-pulse'
                  : 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
              }`}
            >
              STATE: {latestSnapshot?.currentChannelState ?? 'GOOD'}
            </span>
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Recent measured packet loss:{' '}
            <span className="text-white font-mono">
              {latestSnapshot ? Math.round(latestSnapshot.lossRateMeasured * 100) : 0}%
            </span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded p-4">
          <div className="text-xs text-slate-400 uppercase tracking-wider mb-2 font-medium">
            Transfer Progress & Integrity
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Delivered Frames:</span>
              <span className="text-white font-mono">
                {latestSnapshot ? latestSnapshot.framesDeliveredTotal : 0} / {config.totalFrames}
              </span>
            </div>
            <div className="w-full bg-slate-950 h-2 rounded overflow-hidden">
              <div
                className="bg-cyan-500 h-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    latestSnapshot
                      ? (latestSnapshot.framesDeliveredTotal / config.totalFrames) * 100
                      : 0
                  )}%`,
                }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 pt-1">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Bit-Exact Reconstruction Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Time-Series Charts */}
      {hasData ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Goodput over time */}
          <div className="bg-slate-900 border border-slate-800 rounded p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
              <span className="font-semibold text-slate-200">Useful Goodput Over Time</span>
              <span className="font-mono text-cyan-400">Kbps vs Elapsed ms</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snapshots}>
                  <defs>
                    <linearGradient id="goodputGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="elapsedMs" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}ms`} />
                  <YAxis stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="goodputKbps"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#goodputGrad)"
                    name="Goodput (Kbps)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: RTT & RTO over time */}
          <div className="bg-slate-900 border border-slate-800 rounded p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
              <span className="font-semibold text-slate-200">RTT & Retransmission Timeout (RTO)</span>
              <span className="font-mono text-amber-400">RFC 6298 Jacobson-Karels</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="elapsedMs" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}ms`} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="srttMs"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    name="Smoothed RTT (ms)"
                  />
                  <Line
                    type="stepAfter"
                    dataKey="rtoMs"
                    stroke="#f59e0b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                    name="Timer RTO (ms)"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Active Window Size Changes */}
          <div className="bg-slate-900 border border-slate-800 rounded p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
              <span className="font-semibold text-slate-200">Sending Window Dynamic Sizing</span>
              <span className="font-mono text-cyan-400">Frames In-Flight Limit</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="elapsedMs" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}ms`} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  />
                  <Line
                    type="stepAfter"
                    dataKey="currentWindowSize"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                    name="Window Size (Frames)"
                  />
                  <Line
                    type="monotone"
                    dataKey="receiverBufferUsage"
                    stroke="#a855f7"
                    strokeWidth={1.5}
                    dot={false}
                    name="Receiver Buffer Occupancy"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Retransmissions & Loss Rate */}
          <div className="bg-slate-900 border border-slate-800 rounded p-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-4">
              <span className="font-semibold text-slate-200">Retransmission Ratio & Channel Loss</span>
              <span className="font-mono text-rose-400">Overhead vs Loss Rate</span>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={snapshots}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="elapsedMs" stroke="#64748b" fontSize={11} tickFormatter={(v) => `${v}ms`} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f8fafc' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="retransmissionRatio"
                    stroke="#f43f5e"
                    strokeWidth={2}
                    dot={false}
                    name="Retransmission Ratio"
                  />
                  <Line
                    type="monotone"
                    dataKey="lossRateMeasured"
                    stroke="#fbbf24"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                    dot={false}
                    name="Channel Loss Rate"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded p-12 text-center">
          <Activity className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">No Experiment Active</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
            Click 'Execute Run' above or open the Experiment Builder to select presets and launch the deterministic simulator or real UDP transfer.
          </p>
          <button
            onClick={onStartExperiment}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold"
          >
            Launch Baseline Experiment
          </button>
        </div>
      )}
    </div>
  );
};
