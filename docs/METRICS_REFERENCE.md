# AURA-BOLT Metrics Reference Manual

This document provides formal mathematical definitions, calculations, and code implementation mappings for every metric tracked in the AURA-BOLT framework (`src/core/types.ts` and `src/core/simulation/engine.ts`).

---

## Metric Specification Table

| Metric Name | Symbol / Key | Unit | Mathematical Formula & Calculation | Implementation Status | Research Significance |
| :--- | :---: | :---: | :--- | :---: | :--- |
| **Useful Goodput** | $G_{useful}$ / `goodputKbps` | Kbps | $\frac{\text{Delivered Payload Bytes} \times 8}{\text{Elapsed Time (ms)}}$ | **Implemented** | Primary metric of application-level utility; strictly excludes duplicate/retransmitted bytes. |
| **Transmission Throughput** | $T_{wire}$ / `throughputKbps` | Kbps | $\frac{\text{Total Wire Bytes (Payload + Headers)} \times 8}{\text{Elapsed Time (ms)}}$ | **Implemented** | Measures total channel occupancy, including wasted bandwidth from retransmissions. |
| **Smoothed RTT** | $SRTT$ / `srttMs` | ms | $(1 - \alpha) \cdot SRTT + \alpha \cdot RTT_{sample}$ ($\alpha = 0.125$) | **Implemented** | Jacobson filter; provides stable baseline for RTO calculations without noise oscillation. |
| **RTT Variation** | $RTTVAR$ / `rttvar` | ms | $(1 - \beta) \cdot RTTVAR + \beta \cdot \|SRTT - RTT_{sample}\|$ ($\beta = 0.25$) | **Implemented** | Measures network jitter; used to widen timeout bounds under variable queueing. |
| **Retransmission Timeout** | $RTO$ / `rtoMs` | ms | $\max(RTO_{min}, \, SRTT + 4 \cdot RTTVAR)$ | **Implemented** | Prevents spurious timeouts while ensuring fast recovery when a frame is lost. |
| **Observed Loss Rate** | $P_{loss\_obs}$ / `lossRateMeasured` | Ratio | $\frac{\text{Total Packets Dropped}}{\text{Total Packets Processed}}$ | **Implemented** | Empirical verification of channel condition against configured loss probability. |
| **Retransmission Ratio** | $R_{ratio}$ / `retransmissionRatio` | Ratio | $\frac{\text{Total Retransmissions}}{\text{Total Data Frames Sent}}$ | **Implemented** | Directly quantifies protocol overhead; $>50\%$ indicates catastrophic GBN rewind. |
| **Delivery Ratio** | $D_{ratio}$ / `deliveryRatio` | Ratio | $\frac{\text{Delivered In-Order Frames}}{\text{Requested Target Frames}}$ | **Implemented** | Progress completion index; must equal $1.0$ upon successful transfer. |
| **Window Utilization** | $U_{win}$ / `windowUtilization` | $\%$ | $\frac{\text{In-Flight Outstanding Frames}}{W_s}$ | **Implemented** | Reveals whether sender is throttled by congestion window or application data starvation. |
| **Receiver Buffer Occupancy**| $B_{rx}$ / `receiverBufferUsage` | Frames | $\sum \mathbb{I}(\text{slot is buffered out-of-order})$ | **Implemented** | Measures memory pressure on receiver; critical for Selective Repeat buffer limits. |
| **Bandwidth-Delay Product** | $BDP$ / `bdpFrames` | Frames | $\frac{\text{Bandwidth (bps)} \times (2 \cdot T_{delay})}{FrameSize \times 8}$ | **Implemented** | Theoretical window capacity required to fully saturate physical propagation pipe. |
| **Completion Duration** | $T_{total}$ / `durationMs` | ms | $t_{finish} - t_{start}$ | **Implemented** | Total wall-clock or simulation time required to reliably transfer dataset. |
| **Prediction Error** | $\epsilon$ / `predictionError` | $\%$ | $\frac{\|G_{pred} - G_{actual}\|}{G_{actual}} \times 100$ | **Implemented** | Audit metric evaluating controller's internal channel-cost predictive fidelity. |
| **RFC 1071 Checksum** | `checksum` | Hex | 16-bit 1's complement sum over header and payload | **Implemented** | Link-layer error detection; guarantees dropped packets on single-bit errors. |
| **SHA-256 Digest** | `hash` | String | Cryptographic SHA-256 computed on original and destination buffers | **Implemented** | Verifies bit-exact reassembly; zero tolerance for data corruption. |
| **Confidence Interval** | $\text{CI}_{95\%}$ | Units | $\bar{X} \pm t_{0.025, N-1} \cdot \frac{s}{\sqrt{N}}$ | **Derived** | Statistical boundary across multi-seed evaluations. |
