# AURA-BOLT System Architecture Specification

## 1. Architectural Overview & Design Philosophy

**AURA-BOLT** (*Burst-Aware Adaptive ARQ & Sliding Window Optimization Framework*) is designed as an experimental network protocol workstation and research testbed. The system decomposes reliable data transfer research into decoupled layers:

1. **Analytical & Observability User Interface**: Dense, information-rich React/TypeScript workstation featuring time-series telemetry, interactive topological visualization, sliding-window sequence rings, and decision inspectors.
2. **Execution Runtimes (Dual-Engine Architecture)**:
   - **Deterministic Discrete-Event Simulator**: Microsecond-resolution virtual time event scheduler executing across reproducible pseudo-random seeds ($100\%$ determinism guarantee).
   - **Native UDP Socket Engine**: Real kernel-level `dgram` sockets communicating across `127.0.0.1:19001` and `127.0.0.1:19002` with 32-byte binary packet frames, RFC 1071 Internet checksums, and end-to-end SHA-256 integrity verification.
3. **Core Protocol State Machines**: Stop-and-Wait, Go-Back-N, Selective Repeat, and the AURA-BOLT Adaptive Controller.
4. **Physical Channel Impairment Model**: Two-state Gilbert–Elliott Markov chain, Box–Muller Gaussian jitter, asymmetrical forward/reverse loss, and dynamic channel transitions.

---

## 2. High-Level System Architecture Diagram

```mermaid
graph TD
    subgraph UI_Layer ["Research Observability Layer (React 19 + Vite)"]
        Dashboard["Research Dashboard<br/>(Dual Y-Axis Telemetry)"]
        PacketLab["Live Packet Laboratory<br/>(Topology & Sequence Ring)"]
        ProtComp["Protocol Comparison<br/>(6-Chart Benchmark & Heatmap)"]
        AdaptCtrl["Adaptive Controller Inspector<br/>(6-Stage Pipeline & Audit)"]
        ExpBuilder["Experiment Builder<br/>(Studio & UDP Pipeline)"]
        ResAnalysis["Results & Analysis<br/>(Ablation & CDF Distribution)"]
        Docs["Research Documentation<br/>(Specification Dossier)"]
    end

    subgraph Service_Layer ["Application & Telemetry Layer (Express + WS)"]
        RestAPI["REST API Endpoints<br/>(/api/experiments, /api/health)"]
        WsServer["WebSocket Telemetry Hub<br/>(/ws Broadcast Stream)"]
        ConfigMgr["Experiment Configuration Manager<br/>(Preset Scenario Library)"]
    end

    subgraph Engine_Selection ["Execution Engine Multiplexer"]
        EngineRouter{"Execution Mode Selection"}
    end

    subgraph Sim_Runtime ["Deterministic Discrete-Event Simulator"]
        EventQueue["Priority Event Queue<br/>(Sorted by virtual timeMs)"]
        SimClock["Virtual Simulation Clock<br/>(Microsecond granularity)"]
        ChannelModel["Gilbert-Elliott Channel Model<br/>(Park-Miller LCG Seeded RNG)"]
    end

    subgraph UDP_Runtime ["Native UDP Socket Transfer Engine"]
        TxSocket["Sender Socket<br/>(UDP 127.0.0.1:19001)"]
        RxSocket["Receiver Socket<br/>(UDP 127.0.0.1:19002)"]
        BinaryFraming["32-Byte Binary Frame Processor<br/>(RFC 1071 Internet Checksum)"]
        Sha256Validator["SHA-256 Digest Reconstructor<br/>(Bit-Exact Integrity Check)"]
    end

    subgraph Protocol_Layer ["Protocol State Machine Engines"]
        SAW["Stop-and-Wait Engine<br/>(Alternating Bit)"]
        GBN["Go-Back-N Engine<br/>(Cumulative ACK Rewind)"]
        SR["Selective Repeat Engine<br/>(Individual SACK Buffering)"]
        AuraCtrl["AURA-BOLT Adaptive Controller<br/>(Multi-Objective Cost Optimizer)"]
    end

    subgraph Metrics_Subsystem ["Telemetry & Analytics Subsystem"]
        MetricSampler["Moving-Window Metric Collector"]
        AuditLog["Controller Decision Audit Trail"]
        ExportEngine["Data Export Engine<br/>(CSV & JSON Artifacts)"]
    end

    %% Wiring
    UI_Layer <--> Service_Layer
    Service_Layer --> EngineRouter
    EngineRouter -->|Deterministic Mode| Sim_Runtime
    EngineRouter -->|Native Socket Mode| UDP_Runtime

    Sim_Runtime <--> Protocol_Layer
    UDP_Runtime <--> BinaryFraming
    BinaryFraming <--> Sha256Validator

    Protocol_Layer --> MetricSampler
    AuraCtrl --> AuditLog
    MetricSampler --> ExportEngine
    ExportEngine --> Service_Layer
```

---

## 3. Component-Level Protocol & Controller Interactions

```mermaid
flowchart LR
    subgraph Sender_Node ["Sender Node (TX)"]
        TxQueue["Application TX Queue"]
        SendWindow["Sender Sliding Window<br/>[send_base ... send_base + Ws - 1]"]
        RtoTimer["Karn-Jacobson RTO Timers"]
    end

    subgraph Forward_Link ["Forward Transmission Path"]
        DataTransit["In-Flight DATA Frames"]
        FwdMarkov{"Gilbert-Elliott<br/>Forward Filter"}
    end

    subgraph Receiver_Node ["Receiver Node (RX)"]
        RxFilter{"RFC 1071<br/>Checksum Check"}
        RcvBuffer["Out-of-Order SACK Buffer<br/>(Selective Repeat Wr)"]
        InOrderSink["In-Order Application Sink"]
    end

    subgraph Reverse_Link ["Reverse Acknowledgement Path"]
        AckTransit["In-Flight ACK Frames"]
        RevMarkov{"Reverse ACK<br/>Impairment Filter"}
    end

    subgraph Adaptive_Loop ["Closed-Loop AURA-BOLT Engine"]
        KarnFilter["Karn SRTT / RTTVAR Filter"]
        BurstDetector["Burst-Loss Length Estimator"]
        CandidateOptimizer["Multi-Objective Optimizer<br/>J(w) Evaluation"]
    end

    %% Forward Flow
    TxQueue --> SendWindow
    SendWindow -->|Assign Seq #| DataTransit
    DataTransit --> FwdMarkov
    FwdMarkov -->|Pass| RxFilter
    FwdMarkov -->|Drop / Fade| DropSink["Drop Bin"]
    RxFilter -->|Valid| RcvBuffer
    RcvBuffer --> InOrderSink

    %% Reverse Flow
    RcvBuffer -->|Emit ACK/SACK| AckTransit
    AckTransit --> RevMarkov
    RevMarkov -->|Pass| SendWindow
    RevMarkov -->|Drop| AckDropSink["ACK Drop Bin"]

    %% Feedback Loop
    AckTransit -.->|Sample RTT| KarnFilter
    FwdMarkov -.->|Consecutive Drops| BurstDetector
    KarnFilter --> CandidateOptimizer
    BurstDetector --> CandidateOptimizer
    CandidateOptimizer -->|Adapt Window Ws & RTO| SendWindow
    RtoTimer -->|Timeout Expiry| SendWindow
```

---

## 4. End-to-End Experiment Lifecycle Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Researcher as Researcher / UI
    participant Server as Full-Stack Server (server.ts)
    participant Engine as Simulation Engine
    participant Channel as Gilbert-Elliott Channel
    participant Protocols as Protocol State Machine
    participant Controller as AURA-BOLT Controller

    Researcher->>Server: Configure Experiment (Preset / Custom Parameters)
    Server->>Engine: Initialize SimulationEngine(config)
    Engine->>Channel: Seed Park-Miller RNG & Initialize Markov State
    Engine->>Protocols: Initialize Window Slots & State Invariants

    loop Discrete Event Simulation Loop
        Engine->>Protocols: Generate & Schedule DATA Frame
        Protocols->>Channel: Transit Frame (Compute Delay + Jitter)
        Channel->>Channel: Advance Markov State (GOOD <-> BAD)
        alt Frame Dropped
            Channel-->>Engine: Schedule Drop Event (Drop Reason Recorded)
        else Frame Delivered
            Channel-->>Engine: Schedule FRAME_TRANSIT_COMPLETE
            Engine->>Protocols: Deliver Frame to Receiver
            Protocols->>Channel: Schedule Reverse ACK
            Channel-->>Engine: Schedule ACK_TRANSIT_COMPLETE
            Engine->>Protocols: Process ACK & Advance send_base
        end

        opt Decision Epoch (simTime >= lastEval + 300ms)
            Engine->>Controller: evaluate(telemetry, burstStats, RTT)
            Controller->>Controller: Score Candidates J(w) = αG - βL - γR - δB
            Controller-->>Protocols: Apply new Window Size Ws* & RTO*
        end

        Engine-->>Server: Push Telemetry Snapshot via WebSocket
        Server-->>Researcher: Stream Live Visual Metrics
    end

    Engine->>Server: Generate Final ExperimentSummary
    Server-->>Researcher: Render Scorecard & Enable CSV Export
```

---

## 5. Architectural Subsystems

### 5.1 Presentation Subsystem
The user interface is built on React 19 and compiled via Vite 8. It enforces strict separation of concerns across 7 specialized pages:
- **`Dashboard.tsx`**: High-level real-time telemetry, channel indicators, and multi-zone diagnostics.
- **`PacketLaboratory.tsx`**: Microscopic frame-by-frame inspection, dynamic topology animation, and sequence ring diagram.
- **`ProtocolComparison.tsx`**: Side-by-side empirical benchmarking across identical random seeds.
- **`AdaptiveController.tsx`**: White-box algorithmic debugger exposing candidate score breakdowns and Markov burst transitions.
- **`ExperimentBuilder.tsx`**: Configuration laboratory for parameter sweeps, scenario presets, and real UDP socket control.
- **`ResultsAnalysis.tsx`**: Statistical data analysis, prediction-vs-measurement scatter plots, and confidence interval distributions.
- **`ResearchDocs.tsx`**: In-browser academic specification and formal invariant handbook.

### 5.2 Discrete-Event Simulator Runtime
Implemented in `src/core/simulation/engine.ts`:
- **Event Queue**: Priority queue maintained in ascending `timeMs` order.
- **Deterministic Virtual Clock**: Advanced discontinuously from event timestamp to event timestamp, completely decoupling simulation time from CPU speed.
- **Event Primitives**:
  - `FRAME_TRANSIT_COMPLETE`: Arrival of forward payload at receiver.
  - `ACK_TRANSIT_COMPLETE`: Arrival of reverse acknowledgement at sender.
  - `CHECK_TIMEOUTS`: Evaluates whether $t_{sim} \ge t_{sent} + RTO$.
  - `CONTROLLER_EVALUATE`: Epoch trigger for candidate window scoring.
  - `SAMPLE_METRICS`: Regular interval for rolling time-series snapshots.

### 5.3 Native UDP Socket Runtime
Implemented in `src/core/udpTransfer.ts`:
- Uses Node.js `dgram` module binding to localhost IPv4 addresses.
- Sender creates socket on `127.0.0.1:19001`; Receiver binds to `127.0.0.1:19002`.
- Formats every packet into a strict 32-byte binary header followed by binary payload chunk.
- Implements RFC 1071 16-bit 1's complement Internet checksum calculation and verification.
- Enforces real asynchronous timeout timers via `NodeJS.Timeout`.
- Calculates SHA-256 digests over source buffer and reassembled destination buffer to guarantee bit-exact reliability.

### 5.4 Channel Impairment Subsystem
Implemented in `src/core/simulation/channel.ts`:
- **RNG**: Park-Miller Linear Congruential Generator ($a = 16807, m = 2^{31} - 1$).
- **Markov Chain**: 2-state Gilbert–Elliott model with configurable transition probabilities $P(G \to B)$ and $P(B \to B)$.
- **Delay & Jitter**: Base propagation delay augmented with Gaussian noise via the Box–Muller transform:
  $$Z = \sqrt{-2 \ln U_1} \cos(2\pi U_2)$$
- **Asymmetric Losses**: Distinct forward data loss ($P_{data}$) and reverse ACK loss ($P_{ack}$).
