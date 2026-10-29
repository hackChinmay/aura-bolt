// AURA-BOLT Full-Stack Express Server with Native UDP Socket Transfer & Vite Integration

import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

import { SimulationEngine } from './src/core/simulation/engine';
import { DEFAULT_CONFIG, EXPERIMENT_PRESETS } from './src/core/presets';
import { ExperimentConfig, ExperimentSummary } from './src/core/types';
import { RealUdpFileTransferSession } from './src/core/udpTransfer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

app.use(express.json({ limit: '10mb' }));

// Active experiment records memory cache (persisted in SQLite in Python backend)
const experimentsStore: Map<string, { config: ExperimentConfig; summary: ExperimentSummary }> = new Map();
let activeUdpSession: RealUdpFileTransferSession | null = null;

// WebSocket connections
const connectedClients: Set<WebSocket> = new Set();
wss.on('connection', (ws) => {
  connectedClients.add(ws);
  ws.send(JSON.stringify({ type: 'CONNECTED', message: 'AURA-BOLT Telemetry Stream Online' }));

  ws.on('close', () => {
    connectedClients.delete(ws);
  });
});

function broadcastWs(data: any) {
  const msg = JSON.stringify(data);
  for (const client of connectedClients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

// REST Endpoints
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    framework: 'AURA-BOLT Research Platform',
    version: '1.0.0',
    udpSocketSupport: true,
    activeWsClients: connectedClients.size,
  });
});

app.get('/api/presets', (_req: Request, res: Response) => {
  res.json(EXPERIMENT_PRESETS);
});

// Run a single deterministic simulation
app.post('/api/experiments/run', (req: Request, res: Response) => {
  try {
    const config: ExperimentConfig = { ...DEFAULT_CONFIG, ...(req.body || {}) };
    config.id = config.id || `exp-${Date.now()}`;

    const engine = new SimulationEngine(config);
    const summary = engine.runAll();

    experimentsStore.set(config.id, { config, summary });

    res.json({
      success: true,
      summary,
      framesCount: engine.framesHistory.length,
      metricSnapshots: engine.metricSnapshots,
      controllerDecisions: engine.controllerDecisions,
      recentFrames: engine.framesHistory.slice(-100),
    });
  } catch (err: any) {
    console.error('Simulation run failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run 4-protocol comparative benchmark under identical impairment seed
app.post('/api/experiments/compare', (req: Request, res: Response) => {
  try {
    const baseConfig: ExperimentConfig = { ...DEFAULT_CONFIG, ...(req.body || {}) };
    const protocols: Array<{ name: string; type: ExperimentConfig['protocol']; adaptive: boolean }> = [
      { name: 'Stop-and-Wait ARQ', type: 'stop_and_wait', adaptive: false },
      { name: 'Go-Back-N ARQ', type: 'go_back_n', adaptive: false },
      { name: 'Selective Repeat ARQ', type: 'selective_repeat', adaptive: false },
      { name: 'Simple Loss-Rate Adaptive', type: 'loss_rate_adaptive', adaptive: true },
      { name: 'AURA-BOLT (Adaptive Burst-Aware)', type: 'aura_bolt', adaptive: true },
    ];

    const results = protocols.map(p => {
      const cfg: ExperimentConfig = {
        ...baseConfig,
        id: `comp-${p.type}-${Date.now()}`,
        protocol: p.type,
        isAdaptive: p.adaptive,
      };
      const engine = new SimulationEngine(cfg);
      const summary = engine.runAll();
      return {
        protocolName: p.name,
        protocolType: p.type,
        summary,
        metricSnapshots: engine.metricSnapshots,
        decisionsCount: engine.controllerDecisions.length,
      };
    });

    res.json({
      success: true,
      baseConfig,
      results,
    });
  } catch (err: any) {
    console.error('Comparative benchmark failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Run Ablation Study (Burst-Awareness ON vs OFF)
app.post('/api/experiments/ablation', (req: Request, res: Response) => {
  try {
    const seed = req.body?.seed ?? 42;
    const channels = [
      { name: 'Correlated Burst Loss Channel', pattern: 'burst' as const, lossRate: 0.12 },
      { name: 'Independent Bernoulli Channel', pattern: 'random' as const, lossRate: 0.08 },
    ];

    const comparisons = channels.map(ch => {
      const cfgOn: ExperimentConfig = {
        ...DEFAULT_CONFIG,
        id: `ablation-on-${Date.now()}-${Math.random()}`,
        protocol: 'aura_bolt',
        isAdaptive: true,
        enableBurstAwareness: true,
        lossPattern: ch.pattern,
        packetLossRate: ch.lossRate,
        randomSeed: seed,
      };
      const engOn = new SimulationEngine(cfgOn);
      const sumOn = engOn.runAll();

      const cfgOff: ExperimentConfig = {
        ...DEFAULT_CONFIG,
        id: `ablation-off-${Date.now()}-${Math.random()}`,
        protocol: 'aura_bolt',
        isAdaptive: true,
        enableBurstAwareness: false,
        lossPattern: ch.pattern,
        packetLossRate: ch.lossRate,
        randomSeed: seed,
      };
      const engOff = new SimulationEngine(cfgOff);
      const sumOff = engOff.runAll();

      const reduction = sumOff.totalRetransmissions > 0
        ? Math.round(((sumOff.totalRetransmissions - sumOn.totalRetransmissions) / sumOff.totalRetransmissions) * 1000) / 1000
        : 0;

      return {
        channelType: ch.name,
        lossPattern: ch.pattern,
        burstAwareOn: sumOn,
        burstAwareOff: sumOff,
        retransmissionReductionRatio: reduction,
      };
    });

    res.json({
      success: true,
      seed,
      ablationComparisons: comparisons,
    });
  } catch (err: any) {
    console.error('Ablation study failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Real UDP Socket File Transfer Endpoint
app.post('/api/udp-transfer/start', async (req: Request, res: Response) => {
  try {
    const { fileSizeKb = 32, lossRate = 0.05, textContent } = req.body || {};
    
    // Generate payload
    let payloadBuffer: Buffer;
    if (textContent) {
      payloadBuffer = Buffer.from(textContent, 'utf-8');
    } else {
      const bytes = Math.max(1024, Math.min(256 * 1024, fileSizeKb * 1024));
      payloadBuffer = Buffer.alloc(bytes);
      for (let i = 0; i < bytes; i++) {
        payloadBuffer[i] = (i * 31 + 17) % 256;
      }
    }

    if (activeUdpSession) {
      activeUdpSession.closeSockets();
    }

    activeUdpSession = new RealUdpFileTransferSession(payloadBuffer, lossRate);
    await activeUdpSession.start();

    res.json({
      success: true,
      message: 'Real UDP File Transfer initiated between localhost ports 19001 and 19002',
      telemetry: activeUdpSession.getTelemetry(),
    });
  } catch (err: any) {
    console.error('UDP Transfer start error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/udp-transfer/telemetry', (_req: Request, res: Response) => {
  if (!activeUdpSession) {
    return res.json({ status: 'idle', telemetry: null });
  }
  const telem = activeUdpSession.getTelemetry();
  res.json({ status: telem.status, telemetry: telem });
});

// Export CSV
app.get('/api/experiments/:id/export', (req: Request, res: Response) => {
  const exp = experimentsStore.get(req.params.id);
  if (!exp) {
    return res.status(404).send('Experiment not found');
  }

  const s = exp.summary;
  const csv = [
    'Metric,Value,Unit',
    `Protocol,${s.protocol},Identifier`,
    `TotalFramesRequested,${s.totalFramesRequested},Frames`,
    `TotalDataFramesSent,${s.totalDataFramesSent},Frames`,
    `TotalRetransmissions,${s.totalRetransmissions},Frames`,
    `TotalPacketsLost,${s.totalPacketsLost},Frames`,
    `TotalAcksLost,${s.totalAcksLost},Frames`,
    `FinalGoodput,${s.finalGoodputKbps},Kbps`,
    `MeanDeliveryLatency,${s.meanDeliveryLatencyMs},ms`,
    `P95DeliveryLatency,${s.p95DeliveryLatencyMs},ms`,
    `RetransmissionRatio,${s.retransmissionRatio},Ratio`,
    `PeakBufferUsage,${s.peakBufferUsage},Frames`,
    `SenderUtilization,${s.senderUtilization},Ratio`,
    `Duration,${s.durationMs},ms`,
    `IntegrityVerified,${s.integrityVerified},Boolean`,
  ].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="aura-bolt-exp-${req.params.id}.csv"`);
  res.send(csv);
});

// Mount Vite or serve static
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: {
          server: httpServer,
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // Gracefully handle EADDRINUSE by trying next available ports if 3000 is occupied
  let targetPort = PORT;
  const maxAttempts = 10;
  let attempts = 0;

  function bindHttpServer(port: number) {
    httpServer.removeAllListeners('error');
    httpServer.once('error', (err: any) => {
      if (err.code === 'EADDRINUSE' && attempts < maxAttempts) {
        attempts++;
        console.warn(`[AURA-BOLT Notice] Port ${port} is currently in use by another process.`);
        console.warn(`[AURA-BOLT Notice] Attempting fallback to port ${port + 1}...`);
        bindHttpServer(port + 1);
      } else {
        console.error('[AURA-BOLT Fatal Error]', err);
        process.exit(1);
      }
    });

    httpServer.listen(port, 'localhost', () => {
      console.log(`\n======================================================`);
      console.log(`  AURA-BOLT Network Engineering Research Workstation`);
      console.log(`  Local URL:  http://localhost:${port}`);
      console.log(`  WS Stream:  ws://localhost:${port}/ws`);
      if (port !== PORT) {
        console.log(`  Note: Port ${PORT} was occupied; fallback to port ${port}.`);
        console.log(`  To release port ${PORT}, run in PowerShell:`);
        console.log(`    Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`);
      }
      console.log(`======================================================\n`);
    });
  }

  bindHttpServer(targetPort);
}

startServer();
