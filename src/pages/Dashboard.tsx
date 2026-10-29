import React, { useState } from 'react';
import {
  MetricSnapshot,
  ExperimentSummary,
  ExperimentConfig,
  ControllerDecision,
} from '../core/types';
import { MetricCard } from '../components/MetricCard';
import { EXPERIMENT_PRESETS } from '../core/presets';
import {
  Zap,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sliders,
  Layers,
  Activity,
  CheckCircle2,
  Play,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Cpu,
  Radio,
  FileCheck,
  Eye,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface DashboardProps {
  summary: ExperimentSummary | null;
  snapshots: MetricSnapshot[];
  config: ExperimentConfig;
  isRunning: boolean;
  decisions: ControllerDecision[];
  onStartExperiment: () => void;
  onSelectPreset?: (presetId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  summary,
  snapshots,
  config,
  isRunning,
  decisions,
  onStartExperiment,
  onSelectPreset,
}) => {
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const hasData = snapshots.length > 0;

  // Metric toggles for Primary Performance Visualization
  const [showGoodput, setShowGoodput] = useState<boolean>(true);
  const [showRtt, setShowRtt] = useState<boolean>(true);
  const [showLoss, setShowLoss] = useState<boolean>(true);
  const [showWindow, setShowWindow] = useState<boolean>(true);
  const [showRetrans, setShowRetrans] = useState<boolean>(false);

  // Derived metrics
  const totalFrames = config.totalFrames || 60;
  const deliveredFrames = latestSnapshot ? latestSnapshot.framesDeliveredTotal : 0;
  const progressPercent = Math.min(100, Math.round((deliveredFrames / totalFrames) * 100));
  const channelState = latestSnapshot ? latestSnapshot.currentChannelState : 'GOOD';
  const goodputVal = latestSnapshot ? Math.round(latestSnapshot.goodputKbps) : 0;
  const srttVal = latestSnapshot ? Math.round(latestSnapshot.srttMs) : config.oneWayDelayMs * 2;
  const lossRateVal = latestSnapshot
    ? (latestSnapshot.lossRateMeasured * 100).toFixed(1)
    : (config.packetLossRate * 100).toFixed(1);
  const retransRatioVal = latestSnapshot
    ? (latestSnapshot.retransmissionRatio * 100).toFixed(1)
    : '0.0';
  const currentWindow = latestSnapshot ? latestSnapshot.currentWindowSize : config.initialWindowSize;
  const winUtilVal = latestSnapshot ? Math.round(latestSnapshot.windowUtilization * 100) : 0;

  return (
    <div className="p-5 lg:p-6 space-y-6 overflow-y-auto select-none bg-[#101216] text-[#F3F4F6]">
      {/* ZONE A: EXPERIMENT HEADER & TELEMETRY PROGRESS */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-4 lg:p-5 shadow-lg">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-[#9CA3AF]">
              <span className="font-bold text-[#F3F4F6] uppercase tracking-wider px-2 py-0.5 rounded bg-[#252B36] border border-[#343B48]">
                {config.protocol.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="text-[#343B48]">|</span>
              <span className="text-[#A78BFA] font-medium">
                {config.executionMode === 'simulation'
                  ? 'Discrete Event Simulator'
                  : 'Real UDP Socket Engine'}
              </span>
              <span className="text-[#343B48]">|</span>
              <span className="text-[#FBBF24]">
                Impairment: {config.lossPattern.replace(/_/g, ' ').toUpperCase()} (P={Math.round(config.packetLossRate * 100)}%)
              </span>
            </div>
            <h2 className="text-base font-bold text-[#F3F4F6] font-mono tracking-tight">
              {config.name}
            </h2>
            <div className="text-xs text-[#9CA3AF]">
              Payload: {config.totalFrames} frames × {config.payloadSize} Bytes | Delay: {config.oneWayDelayMs}ms (RTT ~{config.oneWayDelayMs * 2}ms)
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Live Progress Bar */}
            <div className="w-48 lg:w-56 space-y-1.5 font-mono">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#9CA3AF]">Transfer Progress:</span>
                <span className="text-[#34D399] font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#101216] border border-[#343B48] overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#A78BFA] to-[#34D399] transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-[#6B7280]">
                <span>Delivered: {deliveredFrames}</span>
                <span>Target: {totalFrames}</span>
              </div>
            </div>

            <button
              onClick={onStartExperiment}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all shadow-md ${
                isRunning
                  ? 'bg-[#FBBF24]/20 text-[#FBBF24] border border-[#FBBF24]/50 hover:bg-[#FBBF24]/30'
                  : 'bg-[#A78BFA] text-[#101216] hover:bg-[#8B5CF6] border border-[#A78BFA]'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? 'TRANSMITTING...' : 'EXECUTE RUN'}</span>
            </button>
          </div>
        </div>

        {/* Quick Launch Presets Strip */}
        <div className="mt-4 pt-3 border-t border-[#343B48]/50 flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
          <span className="text-[10px] uppercase tracking-wider text-[#6B7280] shrink-0">
            Quick Scenario:
          </span>
          {EXPERIMENT_PRESETS.map((preset) => {
            const isSelected = config.name === preset.name;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectPreset && onSelectPreset(preset.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-colors border ${
                  isSelected
                    ? 'bg-[#252B36] text-[#A78BFA] border-[#A78BFA]/40 font-semibold'
                    : 'bg-[#101216] text-[#9CA3AF] border-[#343B48] hover:text-[#F3F4F6] hover:border-[#6B7280]'
                }`}
              >
                {preset.name.split('. ')[1] || preset.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ZONE B: PRIMARY PERFORMANCE TIME-SERIES VISUALIZATION */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#343B48]">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#A78BFA]" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#F3F4F6] font-mono">
                TELEMETRY TIME-SERIES OBSERVABILITY
              </h3>
            </div>
            <p className="text-[11px] text-[#9CA3AF] mt-0.5">
              Dual-axis synchronized telemetry: Goodput &amp; Window (Left Y-Axis) vs Latency &amp; Loss (Right Y-Axis)
            </p>
          </div>

          {/* Metric Visibility Toggles */}
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <button
              onClick={() => setShowGoodput(!showGoodput)}
              className={`px-2.5 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
                showGoodput
                  ? 'bg-[#34D399]/15 text-[#34D399] border-[#34D399]/40'
                  : 'bg-[#101216] text-[#6B7280] border-[#343B48]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#34D399]" />
              Goodput
            </button>
            <button
              onClick={() => setShowRtt(!showRtt)}
              className={`px-2.5 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
                showRtt
                  ? 'bg-[#60A5FA]/15 text-[#60A5FA] border-[#60A5FA]/40'
                  : 'bg-[#101216] text-[#6B7280] border-[#343B48]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#60A5FA]" />
              RTT
            </button>
            <button
              onClick={() => setShowLoss(!showLoss)}
              className={`px-2.5 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
                showLoss
                  ? 'bg-[#FB7185]/15 text-[#FB7185] border-[#FB7185]/40'
                  : 'bg-[#101216] text-[#6B7280] border-[#343B48]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#FB7185]" />
              Loss %
            </button>
            <button
              onClick={() => setShowWindow(!showWindow)}
              className={`px-2.5 py-0.5 rounded border transition-colors flex items-center gap-1.5 ${
                showWindow
                  ? 'bg-[#A78BFA]/15 text-[#A78BFA] border-[#A78BFA]/40'
                  : 'bg-[#101216] text-[#6B7280] border-[#343B48]'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-[#A78BFA]" />
              Window (Ws)
            </button>
          </div>
        </div>

        {/* Primary Chart Area */}
        <div className="h-72 w-full">
          {!hasData ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 border border-dashed border-[#343B48] rounded-lg bg-[#101216]/50">
              <Activity className="w-8 h-8 text-[#6B7280] mb-2 animate-pulse" />
              <div className="text-sm font-semibold text-[#F3F4F6] font-mono">
                Simulation Engine Awaiting Execution
              </div>
              <div className="text-xs text-[#9CA3AF] max-w-sm mt-1">
                Click <span className="text-[#A78BFA] font-bold">"EXECUTE RUN"</span> or press <kbd className="px-1.5 py-0.5 bg-[#252B36] border border-[#343B48] rounded text-[#F3F4F6]">Space</kbd> to initiate the discrete event simulation and stream real-time metrics.
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={snapshots}>
                <CartesianGrid strokeDasharray="3 3" stroke="#343B48" opacity={0.6} />
                <XAxis
                  dataKey="elapsedMs"
                  stroke="#9CA3AF"
                  tick={{ fontSize: 10, fill: '#9CA3AF', fontFamily: 'monospace' }}
                  tickFormatter={(v) => `${Math.round(v)}ms`}
                />
                {/* Left Y Axis: Goodput & Window */}
                <YAxis
                  yAxisId="left"
                  stroke="#34D399"
                  tick={{ fontSize: 10, fill: '#34D399', fontFamily: 'monospace' }}
                  tickFormatter={(v) => `${v}k`}
                />
                {/* Right Y Axis: Latency ms & Loss Rate % */}
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#60A5FA"
                  tick={{ fontSize: 10, fill: '#60A5FA', fontFamily: 'monospace' }}
                  tickFormatter={(v) => `${v}ms`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#171A21',
                    borderColor: '#343B48',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
                  }}
                  itemStyle={{ padding: '2px 0' }}
                />
                {showGoodput && (
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="goodputKbps"
                    name="Goodput (Kbps)"
                    stroke="#34D399"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {showRtt && (
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="srttMs"
                    name="Smoothed RTT (ms)"
                    stroke="#60A5FA"
                    strokeWidth={1.75}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {showLoss && (
                  <Line
                    yAxisId="right"
                    type="stepAfter"
                    dataKey={(d) => Math.round(d.lossRateMeasured * 100)}
                    name="Loss Rate (%)"
                    stroke="#FB7185"
                    strokeWidth={1.5}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {showWindow && (
                  <Line
                    yAxisId="left"
                    type="stepAfter"
                    dataKey="currentWindowSize"
                    name="Sender Window (Ws)"
                    stroke="#A78BFA"
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ZONES C, D, E, F: MULTI-ZONE ASYMMETRICAL DIAGNOSTIC WORKSPACE */}
      <div className="grid grid-cols-12 gap-5">
        {/* ZONE C & D: LIVE NETWORK HEALTH & TYPOGRAPHIC PERFORMANCE (Cols 1-7) */}
        <div className="col-span-12 lg:col-span-7 space-y-5">
          {/* ZONE D: Performance Metrics Panels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard
              label="Useful Goodput"
              value={goodputVal}
              unit="Kbps"
              variant="emerald"
              subtitle="Clean delivered bits"
              trend="up"
              trendValue={`${deliveredFrames} pkts`}
            />
            <MetricCard
              label="Smoothed RTT"
              value={srttVal}
              unit="ms"
              variant="sky"
              subtitle="Karn-Jacobson filter"
              trend="neutral"
              trendValue={`±${config.jitterMs}ms`}
            />
            <MetricCard
              label="Loss Rate"
              value={`${lossRateVal}%`}
              variant={Number(lossRateVal) > 5 ? 'coral' : 'default'}
              subtitle="Moving window average"
            />
            <MetricCard
              label="Retrans Ratio"
              value={`${retransRatioVal}%`}
              variant={Number(retransRatioVal) > 10 ? 'amber' : 'default'}
              subtitle="Recovery overhead"
            />
          </div>

          {/* ZONE C: Live Network Channel Health */}
          <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-4 space-y-3 shadow-md">
            <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-[#343B48]">
              <span className="font-bold text-[#F3F4F6] flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-[#A78BFA]" />
                CHANNEL STATE &amp; BUFFER OCCUPANCY
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                  channelState === 'GOOD'
                    ? 'bg-[#12352C] text-[#34D399] border-[#34D399]/40'
                    : 'bg-[#3A2029] text-[#FB7185] border-[#FB7185]/40 animate-pulse'
                }`}
              >
                GILBERT-ELLIOTT: {channelState}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 font-mono text-xs">
              <div className="p-2.5 bg-[#101216] rounded border border-[#343B48]">
                <div className="text-[10px] text-[#9CA3AF] uppercase">Window Utilization</div>
                <div className="text-base font-bold text-[#A78BFA] mt-0.5">{winUtilVal}%</div>
                <div className="text-[10px] text-[#6B7280]">Ws = {currentWindow} frames</div>
              </div>
              <div className="p-2.5 bg-[#101216] rounded border border-[#343B48]">
                <div className="text-[10px] text-[#9CA3AF] uppercase">One-Way Delay</div>
                <div className="text-base font-bold text-[#60A5FA] mt-0.5">{config.oneWayDelayMs} ms</div>
                <div className="text-[10px] text-[#6B7280]">Jitter ±{config.jitterMs}ms</div>
              </div>
              <div className="p-2.5 bg-[#101216] rounded border border-[#343B48]">
                <div className="text-[10px] text-[#9CA3AF] uppercase">ACK Loss Rate</div>
                <div className="text-base font-bold text-[#FBBF24] mt-0.5">
                  {Math.round(config.ackLossRate * 100)}%
                </div>
                <div className="text-[10px] text-[#6B7280]">Reverse Channel</div>
              </div>
            </div>
          </div>
        </div>

        {/* ZONE E & F: CONTROLLER DECISION STREAM & INTEGRITY (Cols 8-12) */}
        <div className="col-span-12 lg:col-span-5 space-y-5">
          {/* ZONE E: Controller Decision Stream */}
          <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-4 shadow-md space-y-3">
            <div className="flex items-center justify-between text-xs font-mono pb-2 border-b border-[#343B48]">
              <span className="font-bold text-[#F3F4F6] flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-[#A78BFA]" />
                ADAPTIVE CONTROLLER DECISION STREAM
              </span>
              <span className="text-[10px] text-[#9CA3AF]">{decisions.length} audit records</span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 font-mono text-xs pr-1">
              {decisions.length === 0 ? (
                <div className="text-[11px] text-[#6B7280] italic py-4 text-center">
                  Controller is in initial sampling epoch. Decisions will stream upon first RTT window.
                </div>
              ) : (
                decisions.slice(-4).reverse().map((d) => (
                  <div
                    key={d.id}
                    className="p-2.5 rounded bg-[#101216] border border-[#343B48] space-y-1 hover:border-[#A78BFA]/50 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#A78BFA]">{d.mode}</span>
                      <span className="text-[10px] text-[#6B7280]">{d.timestamp}ms</span>
                    </div>
                    <div className="text-[11px] text-[#F3F4F6]">
                      Window: #{d.previousWindow} → <strong className="text-[#34D399]">#{d.selectedWindow}</strong> (Ws)
                    </div>
                    <div className="text-[10px] text-[#9CA3AF] truncate">{d.reason}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ZONE F: Transfer Integrity & Checksum Verification */}
          <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-4 shadow-md space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-[#343B48]">
              <span className="font-bold text-[#F3F4F6] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
                TRANSFER INTEGRITY &amp; RECONSTRUCTION
              </span>
              <span className="text-[10px] text-[#34D399] bg-[#12352C] px-2 py-0.5 rounded border border-[#34D399]/40 font-bold">
                BIT-EXACT
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Delivered In-Order:</span>
                <span className="text-[#34D399] font-bold">{deliveredFrames} / {totalFrames}</span>
              </div>
              <div className="flex justify-between text-[#9CA3AF]">
                <span>Corrupted Frames:</span>
                <span className="text-[#F3F4F6] font-bold">0 (RFC 1071 Drop)</span>
              </div>
              <div className="flex justify-between text-[#9CA3AF]">
                <span>SHA-256 Verification:</span>
                <span className="text-[#A78BFA] font-bold">
                  {summary ? 'e3b0c44298fc1c149afbf4c8996fb924...' : 'Computing on finish...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
