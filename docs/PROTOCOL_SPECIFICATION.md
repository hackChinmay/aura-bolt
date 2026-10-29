# AURA-BOLT Protocol Specification & State Machines

## 1. Sliding Window Protocol Theoretical Foundations

Reliable data transfer protocols operating over unreliable physical links rely on Automatic Repeat reQuest (ARQ) mechanisms. The fundamental distinction between ARQ families lies in their window boundaries, buffering strategies, and acknowledgement semantics.

### 1.1 Sequence Number Space Safety Invariant
In any sliding-window protocol with sequence number space modulo $M$, the sender window size $W_s$ and receiver window size $W_r$ must satisfy the fundamental safety condition:

$$W_s + W_r \le M$$

If this invariant is violated, an old duplicate frame from a previous window cycle can overlap and alias with a new valid frame in the current cycle, resulting in silent data corruption.

- **Stop-and-Wait**: $W_s = 1, W_r = 1 \implies 1 + 1 = 2 \le M$. The alternating bit sequence $\{0, 1\}$ ($M=2$) satisfies this bound.
- **Go-Back-N**: $W_r = 1 \implies W_s + 1 \le M \implies W_s \le M - 1$. A single in-order receive pointer is maintained.
- **Selective Repeat**: For symmetric sender and receiver buffers $W_s = W_r \implies 2 W_s \le M \implies W_s \le \lfloor M / 2 \rfloor$.
- **AURA-BOLT**: Enforces dynamic upper bound $W_s(t) \le \min(W_{max}, B_{max}, \lfloor M / 2 \rfloor)$ at every adaptation epoch.

---

## 2. Comprehensive Protocol Comparison Matrix

| Architectural Dimension | Stop-and-Wait ARQ | Go-Back-N ARQ | Selective Repeat ARQ | AURA-BOLT Adaptive ARQ |
| :--- | :--- | :--- | :--- | :--- |
| **Sender Window Size ($W_s$)** | Fixed $W_s = 1$ | Fixed $W_s > 1$ (Default: 8) | Fixed $W_s > 1$ (Default: 8) | Dynamic $1 \le W_s(t) \le \min(B_{max}, \lfloor M/2 \rfloor)$ |
| **Receiver Buffer Size ($W_r$)** | 1 frame | 1 frame (discards out-of-order) | $W_r = W_s$ (buffers out-of-order) | Dynamic $W_r = W_s(t)$ with SACK reassembly |
| **Acknowledgement Semantics** | Alternating bit ($0$ or $1$) | Cumulative ACK ($ACK(n)$ implies all $< n$ received) | Individual SACK ($ACK(n)$ confirms solely frame $n$) | Dual Cumulative + SACK with Gilbert-Elliott tagging |
| **Retransmission Scope** | Exactly 1 frame on RTO | Entire unacked window $[send\_base \dots next\_seq - 1]$ | Solely the specific timed-out frame | Selective single-frame with burst-fade pacing |
| **Timer Management** | 1 active timer | 1 timer for oldest unacked frame ($send\_base$) | Independent timer per in-flight frame | Independent timers + Karn-Jacobson adaptive RTO |
| **Throughput Efficiency** | $\eta = \frac{1}{1 + 2a}$ where $a = \frac{T_{prop}}{T_{trans}}$ | $\eta = \frac{W (1 - p)}{1 - p + W p}$ under random loss | $\eta = 1 - p$ under independent random loss | $\eta(t) \approx (1 - L_{eff}(t)) \cdot \min(1, \frac{W_s(t)}{BDP})$ |
| **Buffer Overhead** | Minimal (1 frame TX, 1 frame RX) | Low (W frames TX, 1 frame RX) | Moderate (W frames TX, W frames RX) | Adaptive (dynamically bounded by $\delta \cdot \bar{B}$) |
| **Performance under Correlated Burst Loss** | High latency; channel starvation during burst | **Catastrophic collapse**: cascading rewind retransmissions | Moderate: queue stalls until burst end; buffer fills | **High resilience**: detects burst fade and collapses window to prevent in-flight loss |
| **Implementation Source** | `src/core/protocols/stopAndWait.ts` | `src/core/protocols/goBackN.ts` | `src/core/protocols/selectiveRepeat.ts` | `src/core/adaptive/controller.ts` |

---

## 3. Protocol State Machine Invariants & Transition Rules

### 3.1 Stop-and-Wait ARQ State Machine
Implemented in `src/core/protocols/stopAndWait.ts`:

```
               [ SENDER: WAIT_FOR_CALL_0 ]
                          |
        App Data Received | Send Frame(seq=0, data), Start Timer
                          v
               [ SENDER: WAIT_FOR_ACK_0 ]
               /                        \
Timeout / Retransmit(0)            ACK(0) Received / Stop Timer
             |                                    |
             v                                    v
     [ WAIT_FOR_ACK_0 ]                [ SENDER: WAIT_FOR_CALL_1 ]
                                                  |
                                App Data Received | Send Frame(seq=1, data), Start Timer
                                                  v
                                       [ SENDER: WAIT_FOR_ACK_1 ]
```

- **Invariants**:
  - Exactly one frame is in flight at any given instant: $|Outstanding| \le 1$.
  - ACKs carry sequence number matching the accepted frame.
  - Duplicate ACKs or corrupt frames are ignored; timeout guarantees forward progress.

### 3.2 Go-Back-N ARQ State Machine
Implemented in `src/core/protocols/goBackN.ts`:

- **Sender State Invariants**:
  - Window pointers satisfy: $send\_base \le next\_seq \le send\_base + W_s$.
  - Single retransmission timer belongs to $send\_base$.
  - Upon ACK receipt for $n$: $send\_base \leftarrow n + 1$. If $send\_base == next\_seq$, stop timer; else restart timer for new $send\_base$.
- **Timeout Rule (Cascading Rewind)**:
  - When timer expires: Retransmit all frames currently outstanding:
    $$\forall k \in [send\_base, next\_seq - 1]: \quad \text{Transmit}(frame[k])$$
- **Receiver State Invariants**:
  - Maintains single integer: $expected\_seq$.
  - If arriving frame has $seq == expected\_seq$ and valid checksum: accept, pass to application, and increment $expected\_seq \leftarrow (expected\_seq + 1) \bmod M$.
  - If arriving frame has $seq \ne expected\_seq$: discard frame and re-emit $ACK(expected\_seq - 1)$.

### 3.3 Selective Repeat ARQ State Machine
Implemented in `src/core/protocols/selectiveRepeat.ts`:

- **Sender State Invariants**:
  - Independent timer maintained for every slot $k \in [send\_base, send\_base + W_s - 1]$.
  - Arriving $ACK(k)$ marks slot $k$ as `ACKED`.
  - Window slides forward: $send\_base$ advances to the sequence number of the oldest unacknowledged frame.
  - Timer expiration on slot $k$ retransmits **only** frame $k$, leaving all other slots untouched.
- **Receiver State Invariants**:
  - Maintains reassembly buffer of capacity $W_r = W_s$.
  - If $seq \in [rcv\_base, rcv\_base + W_r - 1]$:
    - If $seq == rcv\_base$: deliver frame to application, advance $rcv\_base$ past all consecutively buffered frames, and deliver buffered frames in order.
    - If $seq > rcv\_base$: store frame in out-of-order reassembly buffer.
    - Emit individual $ACK(seq)$ to sender.
  - If $seq \in [rcv\_base - W_r, rcv\_base - 1]$: frame was previously delivered; re-emit $ACK(seq)$ to acknowledge sender's duplicate.

### 3.4 AURA-BOLT Adaptive ARQ State Machine
Implemented in `src/core/adaptive/controller.ts`:

- **Sender Dynamic Window Bounds**:
  $$W_s(t) = \arg\max_{w \in \mathcal{C}} J(w, t)$$
- **Adaptive RTO Mechanism (Karn-Jacobson)**:
  $$SRTT \leftarrow (1 - \alpha) \cdot SRTT + \alpha \cdot RTT_{sample}$$
  $$RTTVAR \leftarrow (1 - \beta) \cdot RTTVAR + \beta \cdot |SRTT - RTT_{sample}|$$
  $$RTO(t) = \max(RTO_{min}, SRTT + 4 \cdot RTTVAR)$$
- **Burst-Aware Window Throttling**:
  - When Gilbert-Elliott burst-loss detector enters `BAD` state or consecutive loss count $N_{loss} \ge 2$:
    $$W_{recovery} = \max\left(1, \min\left(4, \left\lfloor \frac{W_s(t)}{2} \right\rfloor\right)\right)$$
  - Prevents pipe flooding while channel is actively occluded.
