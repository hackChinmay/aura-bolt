# Protocol Design Specification: ARQ & AURA-BOLT

## 1. Sliding Window Protocol Invariants

### 1.1 Sequence Number Space Safety
For sequence number modulus $M$, the relationship between sender window size $W_s$ and receiver window size $W_r$ must satisfy:

$$W_s + W_r \le M$$

- **Stop-and-Wait**: $W_s = 1, W_r = 1 \implies M \ge 2$ (Alternating Bit Protocol: $0$ and $1$).
- **Go-Back-N**: $W_r = 1 \implies W_s \le M - 1$.
- **Selective Repeat**: For symmetric windows $W_s = W_r \implies W_s \le \lfloor M/2 \rfloor$.

If $W_s > M/2$ in Selective Repeat, an old duplicate frame could alias with a new frame within the current window, causing catastrophic data corruption.

---

## 2. Binary Packet Format (Real UDP Transfer)

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|          Magic (0x4142)       |    Version    |   Msg Type    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     Flags     |   Reserved    |        Sequence Number        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|     Sequence Number (cont)    |     Acknowledgement Number    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Acknowledgement Number (cont)|          Window Size          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Payload Length        |           Session ID          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|       Session ID (cont)       |       Internet Checksum       |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                   Timestamp (Microseconds, 64-bit)            |
|                                                               |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                            Payload ...                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

---

## 3. AURA-BOLT Multi-Objective Optimization Objective

Candidate window size $w \in \mathcal{C}$ is scored using the normalized scalarization:

$$J(w) = \alpha \cdot \frac{G_{pred}(w)}{C_{link}} - \beta \cdot \frac{L_{pred}(w)}{3 \cdot SRTT} - \gamma \cdot \frac{R_{pred}(w)}{w} - \delta \cdot \frac{B_{pred}(w)}{B_{max}}$$

Subject to physical constraints:
1. $w \le B_{max}$ (Receiver buffer limit).
2. $w \le \lfloor M / 2 \rfloor$ (Sequence number safety limit).
3. $\alpha + \beta + \gamma + \delta = 1.0$.

When the Gilbert-Elliott Markov chain detects a BAD burst loss state, the effective recovery cost multiplier increases proportionally to $\mu_{burst}$, biasing selection toward conservative windows to prevent pipe flooding.

---

## 4. 8-Step Closed-Loop Control Lifecycle

1. **OBSERVE**: Collect smoothed RTT ($SRTT$), variance ($RTTVAR$), sliding loss rate ($L_{recent}$), consecutive losses ($N_{loss}$), and Markov state estimate ($S \in \{\text{GOOD}, \text{BAD}\}$).
2. **PREDICT**: For candidate window sizes $\mathcal{C} = \{1, 2, 4, \lfloor W/2 \rfloor, W, W+1, W+2, \min(BDP, W_{max})\}$, project goodput, P95 latency, retransmission cost, and buffer occupancy using the recovery cost model.
3. **SELECT**: Pick candidate $w^* = \arg\max_{w \in \mathcal{C}} J(w)$ that satisfies $w \le B_{max}$ and $w \le \lfloor M/2 \rfloor$.
4. **APPLY**: Update sender window $W_s \leftarrow w^*$ and Jacobson-Karels $RTO \leftarrow \max(RTO_{min}, SRTT + 4 \cdot RTTVAR)$ at the epoch boundary.
5. **MEASURE**: After sending at the new window for an observation interval ($\Delta t \ge 150\text{ ms}$), record empirically delivered goodput $G_{actual}$.
6. **VERIFY**: Evaluate prediction accuracy $\epsilon = |G_{pred} - G_{actual}|$. Check if performance collapsed below acceptable bounds ($G_{actual} < 0.45 \cdot G_{pred}$).
7. **UPDATE**: Update model parameters, record outcome in audit trail, and reset consecutive fallback counter if verification succeeded.
8. **FALLBACK**: If $\ge 2$ consecutive prediction failures occur, immediately engage emergency fallback mode: collapse window to conservative safe size $W_{safe} = \max(1, \lfloor W/2 \rfloor)$ to relieve channel congestion.

---

## 5. Comparative Protocol Baselines

1. **Fixed Go-Back-N**: Static window $W=6$, cumulative ACKs, single retransmission timer. A single frame drop forces the retransmission of all in-flight unacknowledged frames.
2. **Fixed Selective Repeat**: Static window $W=6$, individual ACKs and individual retransmission timers, out-of-order buffer reassembly. Only timed-out frames are retransmitted.
3. **Simple Loss-Rate Adaptive**: Standard AIMD adaptation without burst modeling or BDP estimation. Increases window by $+1$ if loss $< 8\%$, halves window ($W/2$) if loss $\ge 8\%$.
4. **AURA-BOLT (Burst-Aware)**: Closed-loop multi-objective optimizer factoring empirical Gilbert-Elliott Markov transition probabilities ($P(G \to B), P(B \to B)$), run lengths, and BDP pipe bounds.
