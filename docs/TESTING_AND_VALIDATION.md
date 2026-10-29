# AURA-BOLT Testing & Protocol Validation Suite

## 1. Test Architecture Overview

The AURA-BOLT framework includes dual test suites:
1. **Frontend / TypeScript Engine Validation**: TypeScript compilation checks (`tsc --noEmit`), Vite production bundling verification, and runtime invariant assertions.
2. **Backend / Python Automated Test Suite**: Comprehensive unit and integration test suite located in `backend/tests/` executed via `pytest`.

---

## 2. Automated Test Suite Inventory

### 2.1 Protocol Correctness Suite (`backend/tests/test_protocols.py`)
- **`test_stop_and_wait_lossless`**: Verifies 1-frame alternating bit transmission and ACK progression.
- **`test_stop_and_wait_with_loss`**: Verifies retransmission timer expiry and recovery upon dropped data frames.
- **`test_go_back_n_cumulative_acks`**: Verifies that arrival of cumulative $ACK(n)$ advances $send\_base$ past all preceding frames.
- **`test_go_back_n_rewind_on_drop`**: Asserts that when frame $k$ is dropped, receiver discards subsequent frames $k+1 \dots$ and sender rewinds window.
- **`test_selective_repeat_out_of_order_buffering`**: Asserts that receiver stores out-of-order frames in $W_r$ buffer and delivers them in order upon arrival of missing sequence.
- **`test_checksum_corruption_rejection`**: Corrupts arbitrary payload bytes and asserts that RFC 1071 checksum verification fails and discards the frame.

### 2.2 Adaptive Controller Suite (`backend/tests/test_adaptive.py`)
- **`test_candidate_window_generation`**: Asserts that candidate set $\mathcal{C}$ enforces safety bounds ($w \le B_{max}$ and $w \le \lfloor M/2 \rfloor$).
- **`test_burst_detection_state_transition`**: Simulates consecutive losses and verifies that the Gilbert–Elliott estimator transitions to `BAD`.
- **`test_conservative_window_collapse`**: Asserts that when channel is `BAD`, window contracts to prevent in-flight flooding.
- **`test_objective_scalarization_weights`**: Verifies that setting $\alpha=1.0$ maximizes goodput while $\beta=1.0$ minimizes latency.

### 2.3 Event Simulator Suite (`backend/tests/test_event_simulator.py`)
- **`test_discrete_clock_monotonicity`**: Asserts that virtual simulation time $t_{sim}$ is strictly monotonically increasing ($t_{i+1} \ge t_i$).
- **`test_seed_reproducibility`**: Executes two independent simulation runs with identical seed $S=1337$ and verifies bit-for-bit identity across event histories.

---

## 3. Recommended Protocol Verification Matrix

| Test Scenario | Verification Condition | Expected State Behavior | Implementation Check |
| :--- | :--- | :--- | :--- |
| **Sequence Wraparound** | Sequence number reaches modulus $M-1 \to 0$ | Next frame assigned $seq=0$; no aliasing with active window slots | Verified in `SimulationEngine` |
| **ACK Loss Resilience** | Reverse ACK frame dropped in channel | Subsequent cumulative ACK rescues in GBN; timer rescues in SR | Verified in `channel.ts` & `engine.ts` |
| **Correlated Burst Loss** | 5 consecutive packet drops | AURA-BOLT detects `BAD` state, shrinks window to $\le 4$, and halts forward flood | Verified in `controller.ts` |
| **Duplicate Delivery** | Delayed frame arrives after timeout retransmission | Receiver acknowledges duplicate and discards payload from application stream | Verified in `selectiveRepeat.ts` |
| **RFC 1071 Bit Inversion** | Single bit flipped in payload slice | Checksum mismatch; packet dropped with reason `CHECKSUM_FAILED` | Verified in `udpTransfer.ts` |
| **SHA-256 Bit-Exactness** | Multi-chunk UDP transfer finishes | $H_{source} == H_{reconstructed}$; bit-for-bit file verification | Verified in `udpTransfer.ts` |

---

## 4. Test Execution Commands

### TypeScript Compilation & Type Validation
```bash
# Validates all core TypeScript types, state machine bounds, and UI bindings
npm run lint
```

### Vite Production Build Verification
```bash
# Validates production bundling, module resolution, and CSS pipeline
npm run build
```

### Python Pytest Suite Execution (Optional Offline Suite)
```bash
cd backend
python -m pytest tests/ -v
```
