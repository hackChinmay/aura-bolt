"""
AURA-BOLT Burst-Aware Adaptive Controller (Python Implementation)
Implements 8-step Predict-Apply-Verify loop and recovery-cost multi-objective optimization:
J(c) = alpha * Goodput - beta * P95_Latency - gamma * Retrans_Cost - delta * Buffer_Usage
"""

from typing import Dict, Any, List, Optional

class AuraBoltController:
    def __init__(
        self,
        alpha: float = 0.40,
        beta: float = 0.25,
        gamma: float = 0.20,
        delta: float = 0.15,
        receiver_buffer_size: int = 24,
        seq_number_modulus: int = 64,
        enable_burst_awareness: bool = True,
    ):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.delta = delta
        self.receiver_buffer_size = receiver_buffer_size
        self.seq_number_modulus = seq_number_modulus
        self.enable_burst_awareness = enable_burst_awareness
        self.decision_history: List[Dict[str, Any]] = []

    def evaluate(
        self,
        sim_time_ms: float,
        current_window: int,
        current_rto: float,
        stats: Dict[str, Any],
        measured_goodput_kbps: float,
    ) -> Dict[str, Any]:
        srtt = stats.get("srtt", 80.0)
        recent_loss = stats.get("recent_loss_rate", 0.05)
        consecutive_losses = stats.get("consecutive_losses", 0)
        channel_state = stats.get("channel_state", "GOOD")
        is_bad = (channel_state == "BAD" or consecutive_losses >= 2) if self.enable_burst_awareness else (recent_loss > 0.15)

        max_safe_window = min(self.receiver_buffer_size, self.seq_number_modulus // 2)

        candidates = [1, 2, 4, max(1, current_window // 2), current_window, min(max_safe_window, current_window + 2)]
        unique_candidates = sorted(list(set(candidates)))

        scored_candidates = []
        for w in unique_candidates:
            # Predict goodput
            burst_penalty = (1.0 + stats.get("mean_burst_length", 1.0) * 0.4) if (self.enable_burst_awareness and is_bad) else 1.0
            eff_loss = min(0.9, recent_loss * burst_penalty)
            pred_goodput = max(10.0, 3000.0 * min(1.0, w / 8.0) * (1.0 - eff_loss))
            pred_latency = srtt + eff_loss * srtt * 2.0
            pred_retrans = w * eff_loss
            pred_buffer = min(self.receiver_buffer_size, w)

            # Normalization
            norm_g = pred_goodput / 3000.0
            norm_l = min(1.0, pred_latency / (srtt * 3.0))
            norm_r = min(1.0, pred_retrans / max(1.0, w))
            norm_b = pred_buffer / self.receiver_buffer_size

            score = (self.alpha * norm_g) - (self.beta * norm_l) - (self.gamma * norm_r) - (self.delta * norm_b)
            scored_candidates.append({
                "window": w,
                "score": round(score, 3),
                "predicted_goodput": round(pred_goodput, 1),
            })

        scored_candidates.sort(key=lambda x: x["score"], reverse=True)

        selected_window = current_window
        mode = "OPTIMAL"
        reason = ""

        if is_bad and consecutive_losses >= 2:
            mode = "CONSERVATIVE_RECOVERY"
            selected_window = max(1, min(4, current_window // 2))
            reason = f"Correlated loss burst detected ({consecutive_losses} consecutive drops). Shrinking window to prevent pipe congestion."
        elif scored_candidates:
            best = scored_candidates[0]
            selected_window = best["window"]
            if selected_window > current_window:
                mode = "PROBING"
                reason = f"Channel is GOOD with low loss ({round(recent_loss*100, 1)}%). Increasing window to {selected_window}."
            elif selected_window < current_window:
                mode = "CONSERVATIVE_RECOVERY"
                reason = f"High recovery cost detected. Downsizing window to {selected_window}."
            else:
                mode = "OPTIMAL"
                reason = f"Current window {current_window} achieves optimal score across Goodput and latency."

        decision = {
            "timestamp": sim_time_ms,
            "mode": mode,
            "previous_window": current_window,
            "selected_window": selected_window,
            "previous_rto": current_rto,
            "selected_rto": stats.get("rto", current_rto),
            "reason": reason,
            "stats": stats,
            "status": "APPLIED",
        }
        self.decision_history.append(decision)
        return decision
