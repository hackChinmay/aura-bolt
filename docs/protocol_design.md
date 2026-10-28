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
