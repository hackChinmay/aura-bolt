# AURA-BOLT Scientific Reproducibility Protocol

## 1. Reproducibility Guarantees

In academic computer systems research, reproducibility is paramount. AURA-BOLT addresses this through its **Dual Execution Architecture**:

### 1.1 Deterministic Simulation Mode (Strict Reproducibility Guarantee)
Under `executionMode: "simulation"`:
- **Pseudo-Random Number Generation**: Uses a 31-bit Linear Congruential Generator (Park–Miller LCG) initialized with an integer `randomSeed`.
- **Virtual Clock**: The simulation engine steps through a discrete event queue. Simulation time advances strictly by scheduled event timestamps rather than system wall-clock time.
- **Guarantee**: Given an identical configuration tuple $(Protocol, Seed, Delay, Loss, W_s)$, two executions on different machines or operating systems produce **100% identical frame histories, loss events, and retransmission timestamps**.

### 1.2 Native UDP Socket Mode (Empirical Operating System Bounds)
Under `executionMode: "real_udp"`:
- Transmissions flow across real operating system kernel network buffers (`dgram` UDP sockets on `127.0.0.1:19001` and `127.0.0.1:19002`).
- Asynchronous thread scheduling, OS CPU preemption, and memory latency introduce slight microsecond-level timing variations.
- Bit-exactness is guaranteed cryptographically via **SHA-256 digest comparison**, while throughput metrics reflect actual kernel socket throughput.

---

## 2. Benchmark Artifact Manifest Specification

Every experiment exported from the platform contains the complete parameter bundle required to reproduce the run:

```json
{
  "manifestVersion": "1.0.0",
  "experimentId": "exp-aura-bolt-baseline-42",
  "timestamp": "2026-10-29T12:00:00.000Z",
  "softwareVersion": "1.2.0",
  "environment": {
    "engine": "discrete_event_simulator",
    "nodeVersion": "v24.14.1",
    "platform": "win32-x64"
  },
  "reproducibilityParameters": {
    "protocol": "aura_bolt",
    "randomSeed": 42,
    "totalFrames": 60,
    "payloadSizeBytes": 1024,
    "oneWayDelayMs": 15,
    "jitterMs": 2,
    "packetLossRate": 0.05,
    "ackLossRate": 0.0,
    "lossPattern": "burst",
    "burstProbabilityGoodToBad": 0.04,
    "burstProbabilityBadToBad": 0.75,
    "initialWindowSize": 8,
    "receiverBufferSize": 32,
    "seqNumberModulus": 64,
    "controllerWeights": {
      "alpha": 0.45,
      "beta": 0.25,
      "gamma": 0.20,
      "delta": 0.10
    },
    "enableBurstAwareness": true
  },
  "verifiedOutcomes": {
    "finalGoodputKbps": 4320.5,
    "durationMs": 1140,
    "totalRetransmissions": 4,
    "meanLatencyMs": 31.2,
    "p95LatencyMs": 54.0,
    "retransmissionRatio": 0.062,
    "sha256Verified": true
  }
}
```

---

## 3. Step-by-Step Reproduction Guide

To independently reproduce a published benchmark result:
1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/hackChinmay/aura-bolt.git
   cd aura-bolt
   npm install --legacy-peer-deps
   ```
2. Launch the workstation:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in a browser.
4. Navigate to the **Experiment Builder** (<kbd>5</kbd>).
5. Input the exact `randomSeed`, `protocol`, and impairment parameters from the manifest.
6. Click **Execute Benchmark Run** or press <kbd>Space</kbd>.
7. Verify that the final goodput, retransmissions, and completion duration match the published scorecard.
