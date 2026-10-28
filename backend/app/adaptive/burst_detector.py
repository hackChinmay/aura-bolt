"""
Burst Loss Detector and Jacobson-Karels RTT/RTO Estimator (Python)
"""

import math
from typing import Dict, Any, List

class BurstDetectorAndRttEstimator:
    def __init__(self, initial_rtt_ms: float = 100.0, initial_rto_ms: float = 300.0):
        self.alpha = 0.125
        self.beta = 0.25
        self.min_rto = 40.0
        self.max_rto = 3000.0

        self.srtt = initial_rtt_ms
        self.rttvar = initial_rtt_ms / 2.0
        self.rto = max(self.min_rto, min(self.max_rto, initial_rto_ms))
        self.sample_count = 0

        self.outcome_history: List[bool] = []
        self.consecutive_losses = 0
        self.burst_lengths: List[int] = []
        self.current_burst = 0

    def record_rtt_sample(self, sample_ms: float):
        if sample_ms <= 0:
            return
        self.sample_count += 1
        if self.sample_count == 1:
            self.srtt = sample_ms
            self.rttvar = sample_ms / 2.0
        else:
            diff = abs(self.srtt - sample_ms)
            self.rttvar = (1 - self.beta) * self.rttvar + self.beta * diff
            self.srtt = (1 - self.alpha) * self.srtt + self.alpha * sample_ms

        raw_rto = self.srtt + 4 * self.rttvar
        self.rto = max(self.min_rto, min(self.max_rto, raw_rto))

    def on_timeout_backoff(self):
        self.rto = min(self.max_rto, self.rto * 1.5)

    def record_outcome(self, is_success: bool):
        self.outcome_history.append(is_success)
        if len(self.outcome_history) > 40:
            self.outcome_history.pop(0)

        if not is_success:
            self.consecutive_losses += 1
            self.current_burst += 1
        else:
            self.consecutive_losses = 0
            if self.current_burst > 0:
                self.burst_lengths.append(self.current_burst)
                self.current_burst = 0

    def get_stats(self) -> Dict[str, Any]:
        total = len(self.outcome_history)
        losses = sum(1 for x in self.outcome_history if not x)
        loss_rate = losses / total if total > 0 else 0.0
        channel_state = "BAD" if (self.consecutive_losses >= 2 or loss_rate > 0.25) else "GOOD"
        mean_burst = (sum(self.burst_lengths) / len(self.burst_lengths)) if self.burst_lengths else 1.0

        return {
            "srtt": round(self.srtt, 1),
            "rttvar": round(self.rttvar, 1),
            "rto": round(self.rto, 1),
            "recent_loss_rate": round(loss_rate, 3),
            "channel_state": channel_state,
            "consecutive_losses": self.consecutive_losses,
            "mean_burst_length": round(mean_burst, 1),
        }
