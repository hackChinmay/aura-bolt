# AURA-BOLT System Architecture Specification

## 1. Executive Summary

AURA-BOLT (**A**daptive **U**tility and **R**ecovery-cost **A**rchitecture with **B**urst-**O**ptimized **L**oss **T**olerance) is a network research platform and protocol framework designed to optimize reliable data transfer over dynamic, burst-loss channels.

This document specifies the end-to-end architecture, decomposition of components, state machine boundaries, and synchronization models.

---

## 2. Architectural Decomposition

The system is organized into decoupled layers:

```
+----------------------------------------------------------------------------------+
|                     AURA-BOLT UI & TELEMETRY DASHBOARD                          |
|  - Real-Time Goodput/RTT/Loss Charts     - Sliding-Window & Flying Frame Canvas  |
|  - Multi-Protocol Radar Comparison       - 8-Step Predict-Apply-Verify Inspector |
+----------------------------------------------------------------------------------+
                                     ^
                                     | REST & WebSocket Telemetry Stream (JSON)
                                     v
+----------------------------------------------------------------------------------+
|                           PROTOCOL ENGINE RUNTIMES                               |
|                                                                                  |
|   [A] Deterministic Discrete-Event Simulator   [B] Real UDP Socket Transfer Engine|
|       - Virtual time (microsecond resolution)      - Linux dgram UDP sockets     |
|       - Priority event queue                       - 32-byte binary frame format |
|       - 100% reproducible random seed traces       - Real SHA-256 hash checks    |
+----------------------------------------------------------------------------------+
                                     |
    +--------------------------------+--------------------------------+
    |                                |                                |
    v                                v                                v
+----------------------+  +----------------------+  +------------------------------+
| ARQ STATE MACHINES   |  | IMPAIRMENT ENGINE    |  | AURA-BOLT CONTROLLER         |
| - Stop-and-Wait      |  | - Gilbert-Elliott    |  | - Jacobson-Karels SRTT/RTTVAR|
| - Go-Back-N (Cumul)  |  |   2-State Markov     |  | - Burst Length Tracking      |
| - Selective Repeat   |  | - Gaussian Jitter    |  | - Multi-Objective Optimizer  |
|   (Individual SACK)  |  | - ACK reverse loss   |  |   J(c) = αG - βL - γR - δB   |
+----------------------+  +----------------------+  +------------------------------+
```

---

## 3. Dual Execution Modes

### Mode A: Deterministic Discrete-Event Simulation Engine
- **Purpose**: Scientifically reproducible benchmarking across protocols under identical pseudo-random seeds.
- **Clock**: Virtual discrete event time ($t \in \mathbb{R}_{\ge 0}$).
- **Determinism Guarantee**: Given seed $S$ and scenario $C$, the exact loss events, flight times, and retransmissions are strictly identical across repeated runs.

### Mode B: Native UDP Socket Live Transfer Engine
- **Purpose**: Physical proof of reliable data delivery over genuine network sockets (`dgram.createSocket('udp4')`).
- **Binary Header**: 32-byte packed binary header with RFC 1071 16-bit 1's complement Internet checksum.
- **Verification**: SHA-256 digest computed on the source buffer and verified bit-for-bit on the reconstructed destination buffer.
