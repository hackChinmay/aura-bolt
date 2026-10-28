# Prior Art Review and Patentability Analysis

## 1. Context & Research Scope

A critical objective of this project is to maintain rigorous scientific honesty. Patentability is evaluated as an open academic inquiry. We explicitly review existing literature, standard RFCs, and commercial implementations to identify prior art and determine the exact novelty boundaries.

---

## 2. Established Prior Art in Reliable Transport

### 2.1 RFC 793 / RFC 5681: Transmission Control Protocol (TCP)
- **Features**: Cumulative acknowledgements, sliding window flow control, slow start, congestion avoidance, fast retransmit, and fast recovery.
- **Relevance**: Standard GBN and sliding window algorithms are public domain foundation mechanisms with half a century of established literature.

### 2.2 RFC 6298: Computing TCP's Retransmission Timer
- **Features**: Jacobson-Karels algorithm for smoothed RTT ($SRTT$) and variance ($RTTVAR$), with exponential backoff on timeouts.
- **Relevance**: AURA-BOLT integrates this standard formula for robust baseline RTO estimation.

### 2.3 RFC 2018: TCP Selective Acknowledgement Options (SACK)
- **Features**: Enables receivers to acknowledge non-contiguous blocks of received packets.
- **Relevance**: Selective Repeat ARQ and SACK form the structural baseline for AURA-BOLT's selective retransmission engine.

### 2.4 Gilbert-Elliott Channel Model (1960, 1963)
- **Literature**: E. N. Gilbert, "Capacity of a burst-noise channel" (1960); E. O. Elliott, "Estimates of error rates for codes on burst-noise channels" (1963).
- **Relevance**: Standard two-state discrete Markov chain for modeling burst fades in wireless and cellular links.

---

## 3. Investigated Technical Contribution

The specific question investigated in AURA-BOLT is:
> *"Does an explicit recovery-cost scalarization model that differentiates between isolated Bernoulli loss and correlated Markov burst loss yield measurable goodput improvements over conventional fixed sliding window protocols and naive loss-rate controllers without violating buffer constraints?"*

### Differentiating Elements:
1. **Coupled Multi-Objective Cost Function**: Explicitly weighting Goodput, P95 Latency, Retransmission Overhead, and Buffer Occupancy simultaneously.
2. **Online Empirical Gilbert-Elliott State Classification**: Real-time transition probability tracking ($P(G \to B), P(B \to B)$) using run-length analysis of recent delivery outcomes.
3. **Closed-Loop Predict-Apply-Verify with Reversion**: Audited candidate evaluation with explicit fallback safety.

### Conclusion on Patentability:
The core primitives (sliding windows, ARQ, Markov channels, linear utility functions) are standard computer science literature. While specialized hardware-controller orchestrations could potentially be claimed in proprietary ASIC/FPGA contexts, the software framework is best situated as an **open research benchmark platform** for academic and protocol engineering analysis.
