"""
Baseline Adaptive Controllers for Comparative Benchmarking.
Implements standard Loss-Rate Adaptive Controller (AIMD without burst-loss or BDP awareness).
"""

from typing import Dict, Any, List, Optional

class LossRateAdaptiveController:
    """
    Standard loss-rate adaptive baseline (Additive Increase / Multiplicative Decrease).
    Adjusts window purely based on whether recent loss exceeds a static threshold,
    with no awareness of Gilbert-Elliott Markov burst states, recovery costs, or BDP.
    """
    def __init__(
        self,
        loss_threshold: float = 0.05,
        min_window: int = 1,
        max_window: int = 24,
        decision_interval_ms: float = 200.0,
    ):
        self.loss_threshold = loss_threshold
        self.min_window = min_window
        self.max_window = max_window
        self.decision_interval_ms = decision_interval_ms
        self.last_eval_time_ms: float = 0.0
        self.decision_history: List[Dict[str, Any]] = []
        self.decision_counter: int = 0

    def evaluate(
        self,
        sim_time_ms: float,
        current_window: int,
        current_rto: float,
        stats: Dict[str, Any],
        measured_goodput_kbps: float = 0.0,
    ) -> Dict[str, Any]:
        if (sim_time_ms - self.last_eval_time_ms) < self.decision_interval_ms and self.last_eval_time_ms > 0.0:
            return {
                "decision_made": False,
                "new_window": current_window,
                "new_rto": current_rto,
                "mode": "STEADY",
            }

        self.last_eval_time_ms = sim_time_ms
        self.decision_counter += 1

        recent_loss = stats.get("recent_loss_rate", 0.0)

        if recent_loss > self.loss_threshold:
            # Multiplicative Decrease
            new_window = max(self.min_window, current_window // 2)
            mode = "MULTIPLICATIVE_DECREASE"
            reason = f"Loss rate {recent_loss*100:.1f}% exceeded threshold {self.loss_threshold*100:.1f}%. Halving window."
        else:
            # Additive Increase
            new_window = min(self.max_window, current_window + 1)
            mode = "ADDITIVE_INCREASE"
            reason = f"Loss rate {recent_loss*100:.1f}% below threshold. Incrementing window by 1."

        decision = {
            "id": f"baseline-dec-{self.decision_counter}",
            "timestamp": round(sim_time_ms, 1),
            "mode": mode,
            "previous_window": current_window,
            "selected_window": new_window,
            "previous_rto": current_rto,
            "selected_rto": stats.get("rto", current_rto),
            "reason": reason,
            "loss_rate": recent_loss,
        }
        self.decision_history.append(decision)

        return {
            "decision_made": True,
            "new_window": new_window,
            "new_rto": stats.get("rto", current_rto),
            "mode": mode,
            "decision": decision,
        }
