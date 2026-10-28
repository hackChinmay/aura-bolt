# AURA-BOLT
## Burst-Aware Adaptive ARQ & Sliding Window Optimization Framework

Academic project on Performance Analysis and Evaluation of ARQ and Sliding Window Protocols.

---

## 1. Project Overview

AURA-BOLT implements, simulates, and benchmarks four reliable data transfer mechanisms:
1. **Stop-and-Wait ARQ** (Alternating Bit Protocol)
2. **Go-Back-N ARQ** (Cumulative ACKs with sender retransmission rewind)
3. **Selective Repeat ARQ** (Individual SACKs with receiver out-of-order buffering)
4. **AURA-BOLT Adaptive ARQ** (Online Gilbert-Elliott burst-loss detection with closed-loop multi-objective recovery cost optimization)

### Dual-Engine Architecture:
- **Deterministic Discrete-Event Simulator**: Microsecond event queue with Gilbert-Elliott Markov channel and 100% reproducible random seeds.
- **Real UDP Socket Transfer Engine**: Linux `dgram` UDP sockets communicating over localhost ports with custom 32-byte binary packet frames, RFC 1071 Internet checksums, and end-to-end SHA-256 verification.

---

## 2. Quick Start

### Frontend & Full-Stack Web Platform (Node.js & Express)
```bash
# Install dependencies
npm install

# Run the full-stack server (serves web UI, REST API, WebSockets, and UDP sockets on port 3000)
npm run dev
```

### Python Backend (Optional / Local Evaluation)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Run Python FastAPI server on port 8000
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# Run Automated Test Suite
pytest tests/ -v
```

---

## 3. Key Pages & Features

- **Page A: Research Dashboard**: Live real-time metric cards (Goodput, RTT, Loss Rate, Window Size, Buffer Occupancy) with time-series charts.
- **Page B: Live Packet Laboratory**: Interactive canvas displaying flying packets, sender and receiver sliding-window slot status, packet inspector modal, and pause/step controls.
- **Page C: Protocol Comparison**: Comparative benchmark of all 4 protocols under identical channel impairment seeds with radar and bar charts.
- **Page D: Adaptive Controller**: 8-step Predict-Apply-Verify inspection table, candidate scoring, and Gilbert-Elliott transition estimates.
- **Page E: Experiment Builder**: 8 curated presets + custom scenario builder + Real UDP File Transfer launcher.
- **Page F: Results & Analysis**: Statistical distributions, confidence intervals, CSV exports, and ablation toggle.
- **Research Paper & Docs**: Integrated formal specification and prior art review.
