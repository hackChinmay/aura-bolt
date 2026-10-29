# Preliminary Novelty & Academic Contribution Assessment

> **DISCLAIMER**: This document represents an academic technical assessment and preliminary research survey prepared for university project evaluation and literature review. **It does not constitute a formal legal opinion on patentability, freedom to operate, or intellectual property rights.**

---

## 1. Technical Problem Addressed

Conventional transport-layer ARQ protocols and congestion control algorithms (such as TCP Reno, Cubic, and standard Selective Repeat implementations) fail to differentiate between:
1. **Isolated random packet losses** (e.g. caused by low signal-to-noise ratio in AWGN channels).
2. **Correlated error bursts** (e.g. caused by multipath fading, Doppler shifts, or temporary shadowing in wireless / mobile / satellite channels).

When an isolated loss occurs, fixed-window or loss-halving protocols over-react by slashing window capacity, leaving high Bandwidth-Delay Product (BDP) pipes underutilized. Conversely, during correlated channel fades, maintaining a static large window floods the link, inducing severe queuing delay (bufferbloat) and cascading retransmissions.

---

## 2. Existing Protocol Mechanisms & Prior Art Survey

- **TCP Reno / NewReno**: Employs Additive Increase Multiplicative Decrease (AIMD). Halves congestion window ($W \leftarrow W/2$) upon any triple-duplicate ACK or timeout. Fails over high-BDP satellite and wireless links due to inability to discern corruption from congestion.
- **TCP Cubic**: Uses a cubic polynomial window growth function parameterized by elapsed time since last loss ($W(t) = C(t - K)^3 + W_{max}$). Highly scalable over high-speed networks, but retains the fundamental assumption that packet drop signifies buffer overflow.
- **Google BBR (Bottleneck Bandwidth and RTT)**: Models the physical network as a pipe with max bandwidth and min RTT. BBR paces transmission rather than reacting purely to packet drops. However, BBR operates primarily at the congestion-control level rather than the link-layer ARQ frame retransmission level, and does not explicitly parameterize Gilbert–Elliott burst-loss recovery costs.
- **Standard Selective Repeat ARQ**: Uses individual sequence timeouts and out-of-order receiver buffers. Lacks closed-loop coupling between dynamic channel Markov state and sender window sizing.

---

## 3. Potential Differentiating Technical Features

The technical contribution of the AURA-BOLT framework centers on the closed-loop combination of:

1. **Online Gilbert–Elliott Fading Burst Discrimination**: Continuous tracking of consecutive frame losses and Markov transition probabilities $P(G \to B)$ and $P(B \to B)$ to distinguish isolated random losses from correlated deep fades.
2. **Multi-Objective Recovery-Cost Scalarization**: Evaluation of candidate window sizes $w \in \mathcal{C}$ at epoch boundaries using normalized dimensional scalarization:
   $$J(w) = \alpha \cdot \bar{G}(w) - \beta \cdot \bar{L}(w) - \gamma \cdot \bar{R}(w) - \delta \cdot \bar{B}(w)$$
   penalizing candidates under active burst states proportionally to estimated burst duration $\mu_{burst}$.
3. **Hard Sequence Modulus Safety Invariant**: Enforcing physical and protocol boundary invariants:
   $$W_s(t) \le \min\left(B_{max}, \, \left\lfloor \frac{M}{2} \right\rfloor\right)$$
   guaranteeing zero sequence number aliasing across arbitrary window adaptations.
4. **8-Step Predict-Apply-Verify Closed Loop**: Verification of measured goodput against model predictions with automatic fallback to conservative bounds upon estimation divergence.

---

## 4. Implementation & Experimental Evidence Required

To substantiate potential claims of novelty in an academic paper or patent disclosure, the following empirical evidence must be gathered:

- **Statistical Significance**: Benchmark sweeps across at least $N \ge 30$ independent random seeds demonstrating statistically significant improvements ($p < 0.01$ via Student's $t$-test) in goodput and tail latency under Gilbert–Elliott burst loss.
- **Ablation Studies**: Rigorous comparison between `enableBurstAwareness: true` and `enableBurstAwareness: false` proving that performance gains stem from Markov burst discrimination rather than window tuning.
- **Real-World Validation**: Expanding beyond localhost UDP socket demonstrations to live wireless testbeds (e.g. 5G/Wi-Fi ad-hoc links or physical satellite emulators).

---

## 5. Potential Technical Advantages to Investigate

- Reduction in total retransmitted bytes during correlated channel fading.
- Faster recovery time after deep fades without triggering RTO exponential backoff cascades.
- Prevention of receiver buffer overflow and sequence aliasing in resource-constrained environments.
- Lower 95th-percentile packet delivery latency across bursty channels.

---

## 6. Known Limitations

- **Localhost Testing**: Localhost sockets experience zero physical propagation delay; artificial delay and jitter must be introduced.
- **Computational Overhead**: Online evaluation of candidate window scores introduces microsecond CPU cost, acceptable for software-defined transport but requiring optimization for gigabit hardware line rates.
- **Markov State Convergence**: In channels where burst characteristics shift rapidly, the estimator requires several round-trips to detect state transitions.

---

## 7. Suggested Search Terms for Prior-Art Investigation

Researchers and reviewers conducting patent and literature searches should use the following boolean query combinations across Google Scholar, IEEE Xplore, ACM Digital Library, and USPTO/EPO databases:

1. `("adaptive ARQ" OR "adaptive sliding window") AND ("burst loss" OR "Gilbert-Elliott") AND ("goodput" OR "recovery cost")`
2. `("selective repeat" OR "sliding window") AND ("multi-objective" OR "utility function") AND ("retransmission timeout" OR "Jacobson")`
3. `("correlated packet loss" OR "Markov channel") AND ("window sizing" OR "flow control") AND ("cross-layer" OR "transport protocol")`
4. `("closed-loop" AND "prediction-verification") AND ("ARQ protocol" OR "UDP reliability")`
