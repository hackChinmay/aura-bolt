"""
Burst Loss Detector and Jacobson-Karels RTT/RTO Estimator.
Implements RFC 6298 RTT estimation, Karn's algorithm, sliding-window loss measurement,
and empirical Gilbert-Elliott Markov transition probability estimation.
"""

from typing import Dict, Any, List, Optional
import math

class BurstDetectorAndRttEstimator:
    def __init__(
        self,
        initial_rtt_ms: float = 80.0,
        initial_rto_ms: float = 300.0,
        min_rto_ms: float = 40.0,
        max_rto_ms: float = 3000.0,
        history_window_size: int = 40,
    ):
        # RFC 6298 parameters
        self.alpha: float = 0.125
        self.beta: float = 0.25
        self.min_rto: float = min_rto_ms
        self.max_rto: float = max_rto_ms

        self.srtt: float = max(1.0, initial_rtt_ms)
        self.rttvar: float = max(1.0, initial_rtt_ms / 2.0)
        self.rto: float = max(self.min_rto, min(self.max_rto, initial_rto_ms))
        self.min_rtt: float = float("inf")
        self.max_rtt: float = 0.0
        self.sample_count: int = 0

        # Outcome history (True = success/ACKed, False = loss/timeout)
        self.history_window_size = history_window_size
        self.outcome_history: List[bool] = []
        self.consecutive_losses: int = 0
        self.current_burst_len: int = 0
        self.observed_bursts: List[int] = []

        # Bandwidth & BDP tracking
        self.total_payload_bytes: int = 0
        self.first_byte_time_ms: Optional[float] = None
        self.last_byte_time_ms: float = 0.0

    def record_rtt_sample(self, sample_ms: float, is_retransmission: bool = False):
        """
        Record RTT sample using Karn's algorithm:
        Never update RTT / RTTVAR estimates for retransmitted frames (RFC 6298).
        """
        if is_retransmission or sample_ms <= 0.0:
            return

        self.sample_count += 1
        self.min_rtt = min(self.min_rtt, sample_ms)
        self.max_rtt = max(self.max_rtt, sample_ms)

        if self.sample_count == 1:
            self.srtt = sample_ms
            self.rttvar = sample_ms / 2.0
        else:
            diff = abs(self.srtt - sample_ms)
            self.rttvar = (1.0 - self.beta) * self.rttvar + self.beta * diff
            self.srtt = (1.0 - self.alpha) * self.srtt + self.alpha * sample_ms

        # RFC 6298: RTO = SRTT + max(G, 4 * RTTVAR)
        raw_rto = self.srtt + 4.0 * self.rttvar
        self.rto = max(self.min_rto, min(self.max_rto, round(raw_rto, 2)))

    def on_timeout_backoff(self):
        """Exponential timer backoff on retransmission timeout."""
        self.rto = min(self.max_rto, round(self.rto * 1.5, 2))

    def record_transmission_outcome(self, is_success: bool):
        """Record whether a frame transmission resulted in an ACK or loss."""
        self.outcome_history.append(is_success)
        if len(self.outcome_history) > self.history_window_size:
            self.outcome_history.pop(0)

        if not is_success:
            self.consecutive_losses += 1
            self.current_burst_len += 1
        else:
            self.consecutive_losses = 0
            if self.current_burst_len > 0:
                self.observed_bursts.append(self.current_burst_len)
                if len(self.observed_bursts) > 30:
                    self.observed_bursts.pop(0)
                self.current_burst_len = 0

    def record_delivered_payload(self, bytes_count: int, sim_time_ms: float):
        self.total_payload_bytes += bytes_count
        if self.first_byte_time_ms is None:
            self.first_byte_time_ms = sim_time_ms
        self.last_byte_time_ms = sim_time_ms

    def estimate_bandwidth_kbps(self) -> float:
        if self.first_byte_time_ms is None or self.last_byte_time_ms <= self.first_byte_time_ms:
            return 3000.0  # default 3 Mbps baseline
        elapsed_sec = (self.last_byte_time_ms - self.first_byte_time_ms) / 1000.0
        if elapsed_sec <= 0.001:
            return 3000.0
        bps = (self.total_payload_bytes * 8.0) / elapsed_sec
        return max(100.0, round(bps / 1000.0, 1))

    def estimate_bdp_frames(self, payload_size_bytes: int = 1024) -> int:
        bw_kbps = self.estimate_bandwidth_kbps()
        rtt_sec = self.srtt / 1000.0
        bdp_bits = (bw_kbps * 1000.0) * rtt_sec
        frames = bdp_bits / (payload_size_bytes * 8.0)
        return max(1, round(frames))

    def get_burst_statistics(self, payload_size_bytes: int = 1024) -> Dict[str, Any]:
        total_samples = len(self.outcome_history)
        losses = sum(1 for x in self.outcome_history if not x)
        recent_loss_rate = (losses / total_samples) if total_samples > 0 else 0.0

        # Run-length burst statistics
        active_bursts = list(self.observed_bursts)
        if self.current_burst_len > 0:
            active_bursts.append(self.current_burst_len)

        mean_burst = (sum(active_bursts) / len(active_bursts)) if active_bursts else 1.0
        max_burst = max(active_bursts) if active_bursts else 0

        # Empirical Gilbert-Elliott transition probabilities P(G -> B) and P(B -> B)
        good_count = 0
        g2b_transitions = 0
        bad_count = 0
        b2b_transitions = 0

        for i in range(len(self.outcome_history) - 1):
            curr_state = self.outcome_history[i]
            next_state = self.outcome_history[i + 1]
            if curr_state:  # GOOD
                good_count += 1
                if not next_state:  # transitioned to BAD
                    g2b_transitions += 1
            else:  # BAD
                bad_count += 1
                if not next_state:  # remained in BAD
                    b2b_transitions += 1

        p_g2b = (g2b_transitions / good_count) if good_count > 0 else 0.05
        p_b2b = (b2b_transitions / bad_count) if bad_count > 0 else 0.70

        # Channel state classification
        channel_state = "BAD" if (self.consecutive_losses >= 2 or recent_loss_rate >= 0.25) else "GOOD"

        return {
            "srtt": round(self.srtt, 2),
            "rttvar": round(self.rttvar, 2),
            "rto": round(self.rto, 2),
            "min_rtt": round(self.min_rtt, 2) if self.min_rtt != float("inf") else 0.0,
            "max_rtt": round(self.max_rtt, 2),
            "sample_count": self.sample_count,
            "recent_loss_rate": round(recent_loss_rate, 4),
            "consecutive_losses": self.consecutive_losses,
            "mean_burst_length": round(mean_burst, 2),
            "max_burst_observed": max_burst,
            "channel_state": channel_state,
            "p_good_to_bad": round(p_g2b, 3),
            "p_bad_to_bad": round(p_b2b, 3),
            "estimated_bandwidth_kbps": self.estimate_bandwidth_kbps(),
            "bdp_frames": self.estimate_bdp_frames(payload_size_bytes),
        }
