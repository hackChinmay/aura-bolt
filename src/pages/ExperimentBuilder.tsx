import React, { useState } from 'react';
import { ExperimentConfig, ProtocolType } from '../core/types';
import { EXPERIMENT_PRESETS, DEFAULT_CONFIG } from '../core/presets';
import {
  Sliders,
  Play,
  RotateCcw,
  CheckCircle,
  FileCheck,
  ShieldCheck,
  Binary,
  Layers,
  Sparkles,
  Zap,
  Radio,
  Server,
  Settings,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExperimentBuilderProps {
  config: ExperimentConfig;
  onChangeConfig: (newConfig: ExperimentConfig) => void;
  onRunSimulation: () => void;
}

export const ExperimentBuilder: React.FC<ExperimentBuilderProps> = ({
  config,
  onChangeConfig,
  onRunSimulation,
}) => {
  const [activeMode, setActiveMode] = useState<'simulator' | 'real_udp'>('simulator');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('stable_network');
  const [isAdvancedOpen, setIsAdvancedOpen] = useState<boolean>(false);

  // Real UDP Transfer local state
  const [udpPayloadSizeKb, setUdpPayloadSizeKb] = useState<number>(32);
  const [udpCustomText, setUdpCustomText] = useState<string>(
    'AURA-BOLT Network Systems Research Laboratory: Verified binary data transfer across real Linux UDP sockets with RFC 1071 internet checksums and end-to-end SHA-256 integrity verification.'
  );
  const [udpTransferActive, setUdpTransferActive] = useState<boolean>(false);
  const [udpTelemetry, setUdpTelemetry] = useState<any>(null);

  const applyPreset = (presetId: string) => {
    const preset = EXPERIMENT_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      setSelectedPresetId(presetId);
      onChangeConfig({
        ...config,
        ...preset.config,
        name: preset.name,
      });
    }
  };

  const handleStartRealUdp = async () => {
    setUdpTransferActive(true);
    try {
      const res = await fetch('/api/udp-transfer/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileSizeKb: udpPayloadSizeKb,
          textContent: udpCustomText,
          lossRate: config.packetLossRate,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setUdpTelemetry(data.telemetry);
        pollUdpTelemetry();
      }
    } catch (err) {
      console.error('Failed to trigger UDP transfer:', err);
      setUdpTransferActive(false);
    }
  };

  const pollUdpTelemetry = () => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/udp-transfer/telemetry');
        const data = await res.json();
        if (data && data.telemetry) {
          setUdpTelemetry(data.telemetry);
          if (data.status === 'completed' || data.status === 'failed') {
            clearInterval(timer);
            setUdpTransferActive(false);
          }
        }
      } catch {
        clearInterval(timer);
        setUdpTransferActive(false);
      }
    }, 200);
  };

  return (
    <div className="p-5 lg:p-6 space-y-6 overflow-y-auto select-none bg-[#101216] text-[#F3F4F6]">
      {/* Top Header & Execution Environment Selector */}
      <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#343B48]">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#9CA3AF]">
              <Settings className="w-4 h-4 text-[#A78BFA]" />
              <span className="font-bold text-[#F3F4F6] uppercase tracking-wider">
                EXPERIMENTAL CONFIGURATION STUDIO
              </span>
            </div>
            <p className="text-xs text-[#9CA3AF] mt-0.5">
              Multi-channel impairment modeling, adaptive cost weights, and genuine Linux socket testing.
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center p-0.5 bg-[#101216] border border-[#343B48] rounded text-xs font-mono">
            <button
              onClick={() => {
                setActiveMode('simulator');
                onChangeConfig({ ...config, executionMode: 'simulation' });
              }}
              className={`px-3 py-1.5 rounded transition-all font-semibold ${
                activeMode === 'simulator'
                  ? 'bg-[#252B36] text-[#A78BFA] border border-[#A78BFA]/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              Deterministic Simulator
            </button>
            <button
              onClick={() => {
                setActiveMode('real_udp');
                onChangeConfig({ ...config, executionMode: 'real_udp' });
              }}
              className={`px-3 py-1.5 rounded transition-all font-semibold ${
                activeMode === 'real_udp'
                  ? 'bg-[#252B36] text-[#FBBF24] border border-[#FBBF24]/30'
                  : 'text-[#9CA3AF] hover:text-[#F3F4F6]'
              }`}
            >
              Real Linux UDP Sockets
            </button>
          </div>
        </div>

        {/* Action Button & Configuration Summary Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs pt-1">
          <div className="text-[#9CA3AF]">
            Effective Plan: <strong className="text-[#F3F4F6]">{config.name}</strong> ·{' '}
            <span className="text-[#A78BFA]">{config.protocol.replace(/_/g, ' ').toUpperCase()}</span> ·{' '}
            <span className="text-[#60A5FA]">{config.totalFrames} frames</span> ·{' '}
            <span className="text-[#FBBF24]">{config.oneWayDelayMs}ms delay</span>
          </div>

          <button
            onClick={activeMode === 'simulator' ? onRunSimulation : handleStartRealUdp}
            className="flex items-center gap-2 px-4 py-2 bg-[#A78BFA] hover:bg-[#8B5CF6] text-[#101216] font-bold rounded-lg transition-all shadow-md shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>
              {activeMode === 'simulator' ? 'EXECUTE BENCHMARK RUN' : 'COMMENCE UDP SOCKET TRANSFER'}
            </span>
          </button>
        </div>
      </div>

      {activeMode === 'simulator' ? (
        <div className="space-y-6">
          {/* SECTION A: SCENARIO PRESET LIBRARY */}
          <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-3 font-mono">
            <div className="text-xs font-bold text-[#F3F4F6] uppercase tracking-wider pb-2 border-b border-[#343B48] flex items-center justify-between">
              <span>SECTION A: RESEARCH SCENARIO PRESET LIBRARY</span>
              <span className="text-[10px] text-[#A78BFA]">8 Reference Baselines</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {EXPERIMENT_PRESETS.map((preset) => {
                const isSelected = config.name === preset.name || selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    className={`p-3 rounded-lg border text-left transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-[#252B36] border-[#A78BFA] shadow-md shadow-[#A78BFA]/10'
                        : 'bg-[#101216] border-[#343B48] hover:border-[#4B5563]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-bold text-[#F3F4F6] truncate max-w-[130px]">
                          {preset.name.split('. ')[1] || preset.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-semibold ${
                            isSelected
                              ? 'bg-[#A78BFA]/20 text-[#A78BFA]'
                              : 'bg-[#252B36] text-[#9CA3AF]'
                          }`}
                        >
                          {preset.badge}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#9CA3AF] line-clamp-2 leading-relaxed font-sans mb-2">
                        {preset.description}
                      </p>
                    </div>

                    <div className="text-[9px] text-[#6B7280] pt-1.5 border-t border-[#343B48]/40 flex justify-between">
                      <span>Loss: {Math.round((preset.config.packetLossRate || 0) * 100)}%</span>
                      <span>RTT: {(preset.config.oneWayDelayMs || 15) * 2}ms</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3-COLUMN CONTROL MATRIX: B, C, D */}
          <div className="grid grid-cols-12 gap-5 font-mono text-xs">
            {/* SECTION B: PROTOCOL CONFIGURATION (Cols 1-4) */}
            <div className="col-span-12 lg:col-span-4 bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
              <div className="text-xs font-bold text-[#F3F4F6] uppercase tracking-wider pb-2 border-b border-[#343B48] flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-[#A78BFA]" />
                SECTION B: PROTOCOL PARAMETERS
              </div>

              <div className="space-y-3">
                {/* Protocol Selector */}
                <div>
                  <label className="text-[10px] text-[#9CA3AF] uppercase block mb-1">
                    ARQ Protocol Architecture
                  </label>
                  <select
                    value={config.protocol}
                    onChange={(e) =>
                      onChangeConfig({
                        ...config,
                        protocol: e.target.value as ProtocolType,
                        isAdaptive:
                          e.target.value === 'aura_bolt' || e.target.value === 'loss_rate_adaptive',
                      })
                    }
                    className="w-full bg-[#101216] border border-[#343B48] rounded px-3 py-1.5 text-[#F3F4F6] focus:outline-none focus:border-[#A78BFA]"
                  >
                    <option value="stop_and_wait">Stop-and-Wait ARQ (Alternating Bit)</option>
                    <option value="go_back_n">Go-Back-N ARQ (Cumulative ACK)</option>
                    <option value="selective_repeat">Selective Repeat ARQ (Individual SACK)</option>
                    <option value="loss_rate_adaptive">Simple Loss-Rate Adaptive</option>
                    <option value="aura_bolt">AURA-BOLT (Burst-Aware Adaptive ARQ)</option>
                  </select>
                </div>

                {/* Frame Count */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Payload Frame Count:</span>
                    <span className="text-[#F3F4F6] font-bold">{config.totalFrames} frames</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="200"
                    step="10"
                    value={config.totalFrames}
                    onChange={(e) =>
                      onChangeConfig({ ...config, totalFrames: Number(e.target.value) })
                    }
                    className="w-full accent-[#A78BFA]"
                  />
                </div>

                {/* Initial Window Size */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Initial Sender Window (Ws):</span>
                    <span className="text-[#A78BFA] font-bold">{config.initialWindowSize} frames</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="32"
                    value={config.initialWindowSize}
                    onChange={(e) =>
                      onChangeConfig({ ...config, initialWindowSize: Number(e.target.value) })
                    }
                    className="w-full accent-[#A78BFA]"
                  />
                </div>

                {/* Sequence Modulus */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Sequence Modulus (M):</span>
                    <span className="text-[#60A5FA] font-bold">M={config.seqNumberModulus || 16}</span>
                  </div>
                  <select
                    value={config.seqNumberModulus || 16}
                    onChange={(e) =>
                      onChangeConfig({ ...config, seqNumberModulus: Number(e.target.value) })
                    }
                    className="w-full bg-[#101216] border border-[#343B48] rounded px-3 py-1.5 text-[#F3F4F6] focus:outline-none focus:border-[#A78BFA]"
                  >
                    <option value="16">16 (4-bit Sequence Numbers)</option>
                    <option value="32">32 (5-bit Sequence Numbers)</option>
                    <option value="64">64 (6-bit Sequence Numbers)</option>
                    <option value="256">256 (8-bit Sequence Numbers)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION C: CHANNEL MODEL (Cols 5-8) */}
            <div className="col-span-12 lg:col-span-4 bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
              <div className="text-xs font-bold text-[#F3F4F6] uppercase tracking-wider pb-2 border-b border-[#343B48] flex items-center gap-2">
                <Radio className="w-3.5 h-3.5 text-[#60A5FA]" />
                SECTION C: CHANNEL IMPAIRMENT
              </div>

              <div className="space-y-3">
                {/* One-Way Delay */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">One-Way Latency:</span>
                    <span className="text-[#60A5FA] font-bold">{config.oneWayDelayMs} ms</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="250"
                    step="5"
                    value={config.oneWayDelayMs}
                    onChange={(e) =>
                      onChangeConfig({ ...config, oneWayDelayMs: Number(e.target.value) })
                    }
                    className="w-full accent-[#60A5FA]"
                  />
                </div>

                {/* Forward Loss Rate */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Data Packet Loss Rate:</span>
                    <span className="text-[#FB7185] font-bold">
                      {(config.packetLossRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.4"
                    step="0.01"
                    value={config.packetLossRate}
                    onChange={(e) =>
                      onChangeConfig({ ...config, packetLossRate: Number(e.target.value) })
                    }
                    className="w-full accent-[#FB7185]"
                  />
                </div>

                {/* ACK Loss Rate */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Reverse ACK Loss Rate:</span>
                    <span className="text-[#FBBF24] font-bold">
                      {(config.ackLossRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="0.3"
                    step="0.01"
                    value={config.ackLossRate}
                    onChange={(e) =>
                      onChangeConfig({ ...config, ackLossRate: Number(e.target.value) })
                    }
                    className="w-full accent-[#FBBF24]"
                  />
                </div>

                {/* Loss Model Pattern */}
                <div>
                  <label className="text-[10px] text-[#9CA3AF] uppercase block mb-1">
                    Error Distribution Process
                  </label>
                  <select
                    value={config.lossPattern}
                    onChange={(e) =>
                      onChangeConfig({ ...config, lossPattern: e.target.value as any })
                    }
                    className="w-full bg-[#101216] border border-[#343B48] rounded px-3 py-1.5 text-[#F3F4F6] focus:outline-none focus:border-[#A78BFA]"
                  >
                    <option value="random">Independent Bernoulli Trials</option>
                    <option value="burst">Gilbert-Elliott 2-State Markov Chain</option>
                    <option value="sudden_degradation">Sudden Channel Step Degradation</option>
                    <option value="recovery">Deep Fade with Subsequent Recovery</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION D: ADAPTIVE OPTIMIZATION WEIGHTS (Cols 9-12) */}
            <div className="col-span-12 lg:col-span-4 bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-4">
              <div className="text-xs font-bold text-[#F3F4F6] uppercase tracking-wider pb-2 border-b border-[#343B48] flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-[#34D399]" />
                SECTION D: ADAPTIVE OPTIMIZATION
              </div>

              <div className="space-y-3">
                {/* Burst Awareness Toggle */}
                <div className="p-2.5 bg-[#101216] rounded-lg border border-[#343B48] flex items-center justify-between">
                  <div>
                    <div className="font-bold text-[#F3F4F6] text-xs">Burst-Loss Awareness</div>
                    <div className="text-[10px] text-[#9CA3AF]">Ablation Study Flag</div>
                  </div>
                  <button
                    onClick={() =>
                      onChangeConfig({
                        ...config,
                        enableBurstAwareness: !config.enableBurstAwareness,
                      })
                    }
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      config.enableBurstAwareness
                        ? 'bg-[#12352C] text-[#34D399] border border-[#34D399]/40'
                        : 'bg-[#252B36] text-[#6B7280] border border-[#343B48]'
                    }`}
                  >
                    {config.enableBurstAwareness ? 'ENABLED' : 'DISABLED'}
                  </button>
                </div>

                {/* Alpha Weight */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Goodput Utility (α):</span>
                    <span className="text-[#34D399] font-bold">{config.alpha}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={config.alpha}
                    onChange={(e) => onChangeConfig({ ...config, alpha: Number(e.target.value) })}
                    className="w-full accent-[#34D399]"
                  />
                </div>

                {/* Beta Weight */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Latency Penalty (β):</span>
                    <span className="text-[#60A5FA] font-bold">{config.beta}</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.1"
                    value={config.beta}
                    onChange={(e) => onChangeConfig({ ...config, beta: Number(e.target.value) })}
                    className="w-full accent-[#60A5FA]"
                  />
                </div>

                {/* Random Seed */}
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-[#9CA3AF]">Reproducible Seed:</span>
                    <span className="text-[#A78BFA] font-bold">{config.randomSeed}</span>
                  </div>
                  <input
                    type="number"
                    value={config.randomSeed}
                    onChange={(e) =>
                      onChangeConfig({ ...config, randomSeed: Number(e.target.value) })
                    }
                    className="w-full bg-[#101216] border border-[#343B48] rounded px-3 py-1.5 text-[#F3F4F6] focus:outline-none focus:border-[#A78BFA]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* REAL LINUX UDP SOCKETS WORKSPACE */
        <div className="bg-[#1D222B] border border-[#343B48] rounded-xl p-5 shadow-lg space-y-5 font-mono text-xs">
          <div className="pb-3 border-b border-[#343B48] flex items-center justify-between">
            <span className="font-bold text-[#F3F4F6] text-sm flex items-center gap-2">
              <Server className="w-4 h-4 text-[#FBBF24]" />
              GENUINE DGRAM UDP SOCKET TRANSFER PIPELINE
            </span>
            <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-[#101216] text-[#FBBF24] border border-[#FBBF24]/40">
              PORT 19001 ➔ 19002
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase text-[#9CA3AF] block font-bold">
                Transfer Payload Text Content
              </label>
              <textarea
                rows={4}
                value={udpCustomText}
                onChange={(e) => setUdpCustomText(e.target.value)}
                className="w-full bg-[#101216] border border-[#343B48] rounded-lg p-3 text-[#F3F4F6] text-xs focus:outline-none focus:border-[#A78BFA]"
              />
            </div>

            <div className="p-4 bg-[#101216] rounded-lg border border-[#343B48] space-y-2">
              <div className="text-[11px] font-bold text-[#F3F4F6] uppercase">Socket Architecture</div>
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed font-sans">
                Packets are framed into 32-byte binary structures, checksummed via RFC 1071 internet algorithm, and transmitted over genuine kernel UDP sockets to verify real socket behavior and buffer handling.
              </p>
              {udpTelemetry && (
                <div className="pt-2 border-t border-[#343B48] text-[#34D399]">
                  Delivered: {udpTelemetry.framesDelivered} / {udpTelemetry.totalFrames} frames ({udpTelemetry.goodputKbps} Kbps)
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
