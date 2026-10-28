import React, { useState, useEffect, useRef } from 'react';
import { Sidebar, PageId } from './components/Sidebar';
import { Header } from './components/Header';
import { Dashboard } from './pages/Dashboard';
import { PacketLaboratory } from './pages/PacketLaboratory';
import { ProtocolComparison } from './pages/ProtocolComparison';
import { AdaptiveControllerPage } from './pages/AdaptiveController';
import { ExperimentBuilder } from './pages/ExperimentBuilder';
import { ResultsAnalysis } from './pages/ResultsAnalysis';
import { ResearchDocs } from './pages/ResearchDocs';

import {
  ExperimentConfig,
  ExperimentSummary,
  MetricSnapshot,
  PacketFrame,
  WindowSlot,
} from './core/types';
import { DEFAULT_CONFIG, EXPERIMENT_PRESETS } from './core/presets';
import { SimulationEngine } from './core/simulation/engine';

export function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');
  const [config, setConfig] = useState<ExperimentConfig>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [simTimeMs, setSimTimeMs] = useState<number>(0);
  const [executionMode, setExecutionMode] = useState<'simulation' | 'real_udp'>('simulation');
  const [wsConnected, setWsConnected] = useState<boolean>(false);

  // Active simulation engine instance ref
  const engineRef = useRef<SimulationEngine | null>(null);

  // Telemetry states for UI
  const [framesHistory, setFramesHistory] = useState<PacketFrame[]>([]);
  const [inFlightFrames, setInFlightFrames] = useState<PacketFrame[]>([]);
  const [senderSlots, setSenderSlots] = useState<WindowSlot[]>([]);
  const [receiverSlots, setReceiverSlots] = useState<WindowSlot[]>([]);
  const [snapshots, setSnapshots] = useState<MetricSnapshot[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [summary, setSummary] = useState<ExperimentSummary | null>(null);

  // Initialize engine with given config
  const initEngine = (cfg: ExperimentConfig) => {
    const engine = new SimulationEngine(cfg);
    engineRef.current = engine;
    setSimTimeMs(0);
    setFramesHistory([]);
    setInFlightFrames([]);
    const slots = engine.getWindowSlots();
    setSenderSlots(slots.senderSlots);
    setReceiverSlots(slots.receiverSlots);
    setSnapshots([]);
    setDecisions([]);
    setSummary(null);
  };

  useEffect(() => {
    initEngine(config);

    // WebSocket connection to backend
    let ws: WebSocket | null = null;
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onclose = () => {
        setWsConnected(false);
      };

      ws.onerror = () => {
        setWsConnected(false);
      };
    } catch {
      setWsConnected(false);
    }

    return () => {
      if (ws) ws.close();
    };
  }, []);

  // Update telemetry states from active engine
  const syncTelemetry = () => {
    const engine = engineRef.current;
    if (!engine) return;

    setSimTimeMs(engine.simTimeMs);
    setFramesHistory([...engine.framesHistory]);
    setInFlightFrames([...engine.activeInFlightFrames]);
    const slots = engine.getWindowSlots();
    setSenderSlots(slots.senderSlots);
    setReceiverSlots(slots.receiverSlots);
    setSnapshots([...engine.metricSnapshots]);
    setDecisions([...engine.controllerDecisions]);

    if (engine.isCompleted) {
      setIsRunning(false);
      setSummary(engine.getSummary());
    }
  };

  // Simulation tick loop
  useEffect(() => {
    let intervalId: any = null;

    if (isRunning) {
      intervalId = setInterval(() => {
        const engine = engineRef.current;
        if (!engine || engine.isCompleted) {
          setIsRunning(false);
          return;
        }

        // Process a batch of 2 events per tick for smooth animation
        for (let i = 0; i < 2; i++) {
          if (!engine.isCompleted) {
            engine.step();
          }
        }
        syncTelemetry();
      }, 50);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isRunning]);

  const handleToggleRun = () => {
    const engine = engineRef.current;
    if (!engine) return;

    if (engine.isCompleted) {
      // Re-init if already finished
      initEngine(config);
      setIsRunning(true);
    } else {
      setIsRunning(!isRunning);
    }
  };

  const handleStep = () => {
    const engine = engineRef.current;
    if (!engine || engine.isCompleted) return;

    engine.step();
    syncTelemetry();
  };

  const handleReset = () => {
    setIsRunning(false);
    initEngine(config);
  };

  const handleChangeConfig = (newConfig: ExperimentConfig) => {
    setConfig(newConfig);
    setIsRunning(false);
    initEngine(newConfig);
  };

  const handleRunImmediate = () => {
    const engine = new SimulationEngine(config);
    engineRef.current = engine;
    const resSummary = engine.runAll();
    syncTelemetry();
    setSummary(resSummary);
    setIsRunning(false);
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden font-sans select-none">
      {/* Professional Technical Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onSelectPage={setCurrentPage}
        isRunning={isRunning}
        activeProtocol={config.protocol}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          currentPage={currentPage}
          isRunning={isRunning}
          onToggleRun={handleToggleRun}
          onReset={handleReset}
          executionMode={executionMode}
          onChangeExecutionMode={setExecutionMode}
          randomSeed={config.randomSeed}
          wsConnected={wsConnected}
        />

        <main className="flex-1 overflow-y-auto bg-[#070b14]">
          {currentPage === 'dashboard' && (
            <Dashboard
              summary={summary}
              snapshots={snapshots}
              config={config}
              isRunning={isRunning}
              decisions={decisions}
              onStartExperiment={handleToggleRun}
              onSelectPreset={(presetId) => {
                const preset = EXPERIMENT_PRESETS.find((p) => p.id === presetId);
                if (preset) {
                  handleChangeConfig({
                    ...config,
                    ...preset.config,
                    name: preset.name,
                  });
                }
              }}
            />
          )}

          {currentPage === 'packet_lab' && (
            <PacketLaboratory
              framesHistory={framesHistory}
              inFlightFrames={inFlightFrames}
              senderSlots={senderSlots}
              receiverSlots={receiverSlots}
              config={config}
              isRunning={isRunning}
              onToggleRun={handleToggleRun}
              onStep={handleStep}
              onReset={handleReset}
              simTimeMs={simTimeMs}
            />
          )}

          {currentPage === 'comparison' && (
            <ProtocolComparison baseConfig={config} />
          )}

          {currentPage === 'adaptive' && (
            <AdaptiveControllerPage decisions={decisions} config={config} />
          )}

          {currentPage === 'builder' && (
            <ExperimentBuilder
              config={config}
              onChangeConfig={handleChangeConfig}
              onRunSimulation={handleRunImmediate}
            />
          )}

          {currentPage === 'results' && (
            <ResultsAnalysis
              summary={summary}
              snapshots={snapshots}
              decisions={decisions}
            />
          )}

          {currentPage === 'docs' && <ResearchDocs />}
        </main>
      </div>
    </div>
  );
}

export default App;
