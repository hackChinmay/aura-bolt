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
  const [activeTab, setActiveTab] = useState<'simulator' | 'real_udp'>('simulator');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('stable_network');

  // Real UDP Transfer local state
  const [udpPayloadSizeKb, setUdpPayloadSizeKb] = useState<number>(32);
  const [udpCustomText, setUdpCustomText] = useState<string>(
    'AURA-BOLT Network Research Protocol: Verified bit-exact data transfer across genuine Linux UDP sockets with RFC 1071 internet checksums and SHA-256 integrity verification.'
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
    <div className="p-6 space-y-6 overflow-y-auto">
      {/* Top Segmented Controls: Simulator vs Real UDP */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded p-4">
        <div>
          <h2 className="text-base font-semibold text-white">Experiment & Scenario Engine</h2>
          <p className="text-xs text-slate-400">
            Configure channel delay, jitter, Gilbert-Elliott burst transitions, or trigger genuine UDP file transfers.
          </p>
        </div>

        <div className="flex items-center p-0.5 bg-slate-950 border border-slate-800 rounded">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'simulator'
                ? 'bg-slate-800 text-cyan-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Deterministic Simulator
          </button>
          <button
            onClick={() => setActiveTab('real_udp')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'real_udp'
                ? 'bg-slate-800 text-amber-400 font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Real UDP Socket Transfer
          </button>
        </div>
      </div>

      {activeTab === 'simulator' ? (
        <div className="space-y-6">
          {/* Preset Selector */}
          <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wider">
                Benchmark Presets (Click to Apply)
              </span>
              <span className="text-slate-500 text-[11px]">8 Curated Network Environments</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {EXPERIMENT_PRESETS.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    onClick={() => applyPreset(preset.id)}
                    className={`text-left p-3 rounded border text-xs transition-all ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200 shadow-sm'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-white truncate">{preset.name}</span>
                      <span className="text-[10px] text-cyan-400 font-mono">{preset.badge}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                      {preset.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Parameter Sliders Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Protocol & Sliding Window Bounds */}
            <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">
              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">
                1. Protocol & Window Limits
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Reliable Protocol</label>
                <select
                  value={config.protocol}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      protocol: e.target.value as ProtocolType,
                      isAdaptive: e.target.value === 'aura_bolt',
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="aura_bolt">AURA-BOLT (Burst-Aware Adaptive)</option>
                  <option value="selective_repeat">Selective Repeat ARQ</option>
                  <option value="go_back_n">Go-Back-N ARQ</option>
                  <option value="stop_and_wait">Stop-and-Wait ARQ</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Initial Window Size:</span>
                  <span className="text-white font-mono">{config.initialWindowSize} frames</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="32"
                  value={config.initialWindowSize}
                  onChange={(e) =>
                    onChangeConfig({ ...config, initialWindowSize: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Receiver Buffer Size:</span>
                  <span className="text-white font-mono">{config.receiverBufferSize} frames</span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="48"
                  value={config.receiverBufferSize}
                  onChange={(e) =>
                    onChangeConfig({ ...config, receiverBufferSize: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Total Payload Frames:</span>
                  <span className="text-white font-mono">{config.totalFrames} frames</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="150"
                  step="10"
                  value={config.totalFrames}
                  onChange={(e) =>
                    onChangeConfig({ ...config, totalFrames: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Initial RTO Timer:</span>
                  <span className="text-white font-mono">{config.initialRtoMs} ms</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="800"
                  step="25"
                  value={config.initialRtoMs}
                  onChange={(e) =>
                    onChangeConfig({ ...config, initialRtoMs: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>
            </div>

            {/* Column 2: Channel Impairments */}
            <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">
              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">
                2. Channel Delay & Loss Pattern
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>One-Way Delay:</span>
                  <span className="text-white font-mono">{config.oneWayDelayMs} ms</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="200"
                  value={config.oneWayDelayMs}
                  onChange={(e) =>
                    onChangeConfig({ ...config, oneWayDelayMs: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Gaussian Jitter:</span>
                  <span className="text-white font-mono">±{config.jitterMs} ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={config.jitterMs}
                  onChange={(e) =>
                    onChangeConfig({ ...config, jitterMs: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Data Packet Loss Rate:</span>
                  <span className="text-rose-400 font-mono">
                    {Math.round(config.packetLossRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.30"
                  step="0.01"
                  value={config.packetLossRate}
                  onChange={(e) =>
                    onChangeConfig({ ...config, packetLossRate: parseFloat(e.target.value) })
                  }
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Reverse ACK Loss Rate:</span>
                  <span className="text-amber-400 font-mono">
                    {Math.round(config.ackLossRate * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="0.25"
                  step="0.01"
                  value={config.ackLossRate}
                  onChange={(e) =>
                    onChangeConfig({ ...config, ackLossRate: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Loss Impairment Model</label>
                <select
                  value={config.lossPattern}
                  onChange={(e) =>
                    onChangeConfig({
                      ...config,
                      lossPattern: e.target.value as any,
                    })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="burst">Gilbert-Elliott Markov Chain (Burst)</option>
                  <option value="random">Independent Bernoulli Loss (Random)</option>
                  <option value="alternating">Alternating Channel Fade</option>
                  <option value="sudden_degradation">Sudden Mid-Transfer Degradation</option>
                  <option value="recovery">Deep Fade With Recovery</option>
                </select>
              </div>
            </div>

            {/* Column 3: AURA-BOLT Objective Weights & Ablation */}
            <div className="bg-slate-900 border border-slate-800 rounded p-4 space-y-4">
              <div className="text-xs font-semibold text-slate-200 uppercase tracking-wider pb-2 border-b border-slate-800">
                3. Adaptive Weights & Ablation
              </div>

              <div className="bg-slate-950 p-3 rounded border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Ablation: Burst Awareness</span>
                  <input
                    type="checkbox"
                    checked={config.enableBurstAwareness}
                    onChange={(e) =>
                      onChangeConfig({ ...config, enableBurstAwareness: e.target.checked })
                    }
                    className="w-4 h-4 accent-cyan-500 rounded"
                  />
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  Toggle off to disable Gilbert-Elliott burst correlation and evaluate baseline loss-rate control.
                </p>
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Goodput Weight (α):</span>
                  <span className="text-cyan-400 font-mono">{config.alpha}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.8"
                  step="0.05"
                  value={config.alpha}
                  onChange={(e) =>
                    onChangeConfig({ ...config, alpha: parseFloat(e.target.value) })
                  }
                  className="w-full accent-cyan-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Latency Penalty (β):</span>
                  <span className="text-amber-400 font-mono">{config.beta}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.05"
                  value={config.beta}
                  onChange={(e) =>
                    onChangeConfig({ ...config, beta: parseFloat(e.target.value) })
                  }
                  className="w-full accent-amber-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Retransmission Penalty (γ):</span>
                  <span className="text-rose-400 font-mono">{config.gamma}</span>
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.5"
                  step="0.05"
                  value={config.gamma}
                  onChange={(e) =>
                    onChangeConfig({ ...config, gamma: parseFloat(e.target.value) })
                  }
                  className="w-full accent-rose-500"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Pseudo-Random Seed:</span>
                  <span className="text-white font-mono">{config.randomSeed}</span>
                </div>
                <input
                  type="number"
                  value={config.randomSeed}
                  onChange={(e) =>
                    onChangeConfig({ ...config, randomSeed: parseInt(e.target.value) || 42 })
                  }
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono"
                />
              </div>

              <button
                onClick={onRunSimulation}
                className="w-full mt-2 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded text-xs font-semibold tracking-wide transition-colors flex items-center justify-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Execute Configured Simulation</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Real UDP File Transfer Mode */
        <div className="bg-slate-900 border border-slate-800 rounded p-6 space-y-6">
          <div className="flex items-start justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-white">Genuine Localhost UDP File Transfer</span>
                <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-500/30 font-mono px-2 py-0.5 rounded font-bold">
                  NATIVE dgram SOCKETS
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Binds two distinct UDP sockets on 127.0.0.1 (Sender: port 19001, Receiver: port 19002) using Node.js `dgram` library.
                Packets are framed in 32-byte binary structures with RFC 1071 checksums and verified using SHA-256.
              </p>
            </div>

            <button
              onClick={handleStartRealUdp}
              disabled={udpTransferActive}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded text-xs font-bold tracking-wide transition-colors shadow-lg"
            >
              {udpTransferActive ? 'Transferring Across UDP Sockets...' : 'Initiate Real UDP Transfer'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Payload Content</label>
                <textarea
                  rows={4}
                  value={udpCustomText}
                  onChange={(e) => setUdpCustomText(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded p-3 text-xs text-white font-mono focus:outline-hidden focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="text-slate-400">Preset Size:</span>
                {[16, 32, 64, 128].map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      setUdpPayloadSizeKb(sz);
                      setUdpCustomText('');
                    }}
                    className={`px-2.5 py-1 rounded border ${
                      udpPayloadSizeKb === sz && !udpCustomText
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    {sz} KB
                  </button>
                ))}
              </div>
            </div>

            {/* Live UDP Status & SHA-256 Verification Card */}
            <div className="bg-slate-950 border border-slate-800 rounded p-4 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-semibold text-slate-300">Live UDP Telemetry</span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    udpTelemetry?.status === 'completed'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                      : udpTransferActive
                      ? 'bg-cyan-950 text-cyan-400 border border-cyan-500/30 animate-pulse'
                      : 'text-slate-500'
                  }`}
                >
                  {udpTelemetry ? udpTelemetry.status.toUpperCase() : 'READY'}
                </span>
              </div>

              {udpTelemetry ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Total Size:</span>
                    <span className="text-white font-bold">{udpTelemetry.totalBytes} Bytes ({udpTelemetry.totalChunks} Chunks)</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Delivered & Acked:</span>
                    <span className="text-emerald-400 font-bold">{udpTelemetry.chunksAcked} / {udpTelemetry.totalChunks}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Retransmissions:</span>
                    <span className="text-rose-400 font-bold">{udpTelemetry.retransmissions}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-400">Real Goodput:</span>
                    <span className="text-cyan-400 font-bold">{udpTelemetry.goodputKbps} Kbps</span>
                  </div>

                  {/* SHA-256 Hash Matching */}
                  <div className="pt-2 border-t border-slate-800/80 space-y-1">
                    <div className="text-[10px] text-slate-500">Sender SHA-256 Digest:</div>
                    <div className="text-[10px] text-cyan-300 truncate">{udpTelemetry.senderOriginalSha256}</div>
                    
                    <div className="text-[10px] text-slate-500 pt-1">Receiver Reconstructed SHA-256:</div>
                    <div className="text-[10px] text-emerald-300 truncate">{udpTelemetry.receiverReconstructedSha256}</div>

                    <div className="pt-2 flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                      <ShieldCheck className="w-4 h-4" />
                      <span>{udpTelemetry.integrityVerified ? 'BIT-EXACT SHA-256 MATCH CONFIRMED' : 'Reconstructing Stream...'}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 italic">
                  Press 'Initiate Real UDP Transfer' to transmit binary chunks over localhost UDP sockets.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
