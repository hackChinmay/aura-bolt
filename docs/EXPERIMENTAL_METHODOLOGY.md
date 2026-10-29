# AURA-BOLT Experimental Research Methodology

## 1. Research Hypotheses

This benchmarking framework is designed to evaluate three formal network engineering hypotheses:

- **Hypothesis 1 ($H_1$ - Channel Starvation in High-BDP Networks)**: In networks where Bandwidth-Delay Product satisfies $BDP \gg 1$, Stop-and-Wait ARQ underutilizes available capacity by a factor bounded by $1 / (1 + 2a)$, whereas sliding-window protocols with $W \approx BDP$ approach channel capacity.
- **Hypothesis 2 ($H_2$ - Catastrophic Collapse in Go-Back-N under Correlated Loss)**: Under correlated Gilbert–Elliott fading bursts ($P(B \to B) > 0.7$), Go-Back-N exhibits cascading retransmission collapse, resulting in a retransmission ratio exceeding $50\%$, whereas Selective Repeat confines retransmissions to missing sequence slots.
- **Hypothesis 3 ($H_3$ - Burst-Aware Adaptive Optimization Gain)**: Under dynamic channel transitions from clear states to burst fades, a closed-loop multi-objective controller that contracts the window during burst detection ($S = \text{BAD}$) achieves higher goodput and lower P95 tail latency than static window sizing or naive loss-rate adaptation.

---

## 2. Experimental Variable Classification

```
+---------------------------------------------------------------------------------------+
| INDEPENDENT VARIABLES                                                                |
| - Protocol Architecture: Stop-and-Wait, Go-Back-N, Selective Repeat, AURA-BOLT        |
| - One-Way Delay (ms): 5 ms (LAN) to 250 ms (GEO Satellite)                            |
| - Jitter (ms): 0 ms to 25 ms (Gaussian Box-Muller)                                    |
| - Data Packet Loss Probability: 0.0 to 0.30                                           |
| - Reverse ACK Loss Probability: 0.0 to 0.20                                           |
| - Impairment Pattern: Independent Random, Gilbert-Elliott Burst, Step Fade, Recovery   |
| - Window Capacity (Ws): 1 to 32 frames                                                |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| CONTROLLED VARIABLES                                                                  |
| - Pseudo-Random Seed: Fixed Park-Miller integer (e.g. Seed = 42, 1337)                |
| - Payload Size per Frame: 1024 Bytes                                                  |
| - Total Frames Transmitted: Standard benchmark of 60 frames (61,440 Bytes)            |
| - Sequence Modulus: Modulo M = 16 (or M = 64)                                         |
| - Maximum Link Capacity: 5000 Kbps                                                    |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
| DEPENDENT / MEASURED VARIABLES                                                        |
| - Final Useful Goodput (Kbps): Delivered application bits / total elapsed time        |
| - Total Duration / Completion Time (ms)                                               |
| - Retransmission Overhead Ratio: Total Retransmitted / Total Data Frames Sent          |
| - Mean & 95th-Percentile Latency (ms): One-way frame transit plus recovery delay      |
| - Receiver Buffer Occupancy: Peak and mean buffer slots occupied                      |
| - SHA-256 Bit-Exact Verification: Binary digest matching                              |
+---------------------------------------------------------------------------------------+
```

---

## 3. Repeated Trials & Random Seed Policy

1. **Deterministic Benchmark Comparison**: When evaluating protocol superiority, all four protocols (Stop-and-Wait, Go-Back-N, Selective Repeat, and AURA-BOLT) must be executed against the **exact identical random seed**. This guarantees that the exact same frame sequence numbers encounter the exact same packet drops and delay spikes.
2. **Multi-Seed Statistical Sweeps**: For aggregate publication-grade evaluations, benchmarks should be repeated across at least $N = 30$ distinct random seeds:
   $$\text{Seeds} = \{101, 102, \dots, 130\}$$
3. **Statistical Aggregation**: Compute sample mean $\bar{X}$, standard deviation $s$, and $95\%$ Student's $t$ confidence interval:
   $$\text{CI}_{95\%} = \bar{X} \pm t_{0.025, N-1} \cdot \frac{s}{\sqrt{N}}$$

---

## 4. Ablation Study Methodology

To verify that measured performance gains in AURA-BOLT arise from **burst-loss awareness** rather than general window tuning, the framework incorporates an explicit ablation flag:

- **Treatment Group (`enableBurstAwareness: true`)**: The controller monitors consecutive packet drops, tracks transition probabilities $P(G \to B)$ and $P(B \to B)$, and penalizes candidate window sizes when the channel is identified as `BAD`.
- **Ablation Control Group (`enableBurstAwareness: false`)**: The controller ignores Markov burst state, treating all loss as independent Bernoulli trials and reacting solely to the moving-average loss rate.

---

## 5. Experiment Configuration Template (JSON Schema)

```json
{
  "id": "exp-custom-geo-satellite-01",
  "name": "GEO Satellite with Rain Fade",
  "protocol": "aura_bolt",
  "isAdaptive": true,
  "totalFrames": 80,
  "payloadSize": 1024,
  "oneWayDelayMs": 150,
  "jitterMs": 10,
  "packetLossRate": 0.05,
  "ackLossRate": 0.01,
  "bandwidthKbps": 5000,
  "lossPattern": "burst",
  "burstMeanLength": 4,
  "burstProbabilityGoodToBad": 0.04,
  "burstProbabilityBadToBad": 0.75,
  "initialWindowSize": 16,
  "maxWindowSize": 32,
  "receiverBufferSize": 32,
  "initialRtoMs": 650,
  "seqNumberModulus": 64,
  "alpha": 0.45,
  "beta": 0.25,
  "gamma": 0.20,
  "delta": 0.10,
  "enableBurstAwareness": true,
  "randomSeed": 42,
  "executionMode": "simulation"
}
```
