"""
Multi-Objective Recovery-Cost Model for AURA-BOLT.
Evaluates candidate window sizes against Goodput, Latency, Retransmission Cost, and Buffer Usage:
J(w) = alpha * Goodput - beta * Latency - gamma * Retransmissions - delta * Buffer
"""

from typing import Dict, Any, List, Optional
import math

class CandidateEvaluation:
    __slots__ = (
        "window_size",
        "predicted_goodput_kbps",
        "predicted_p95_latency_ms",
        "predicted_retrans_cost",
        "predicted_buffer_usage",
        "score",
        "is_feasible",
        "rejection_reason",
    )

    def __init__(
        self,
        window_size: int,
        predicted_goodput_kbps: float,
        predicted_p95_latency_ms: float,
        predicted_retrans_cost: float,
        predicted_buffer_usage: int,
        score: float,
        is_feasible: bool = True,
        rejection_reason: Optional[str] = None,
    ):
        self.window_size = window_size
        self.predicted_goodput_kbps = predicted_goodput_kbps
        self.predicted_p95_latency_ms = predicted_p95_latency_ms
        self.predicted_retrans_cost = predicted_retrans_cost
        self.predicted_buffer_usage = predicted_buffer_usage
        self.score = score
        self.is_feasible = is_feasible
        self.rejection_reason = rejection_reason

    def to_dict(self) -> Dict[str, Any]:
        return {
            "window_size": self.window_size,
            "predicted_goodput_kbps": round(self.predicted_goodput_kbps, 1),
            "predicted_p95_latency_ms": round(self.predicted_p95_latency_ms, 1),
            "predicted_retrans_cost": round(self.predicted_retrans_cost, 2),
            "predicted_buffer_usage": self.predicted_buffer_usage,
            "score": round(self.score, 4),
            "is_feasible": self.is_feasible,
            "rejection_reason": self.rejection_reason,
        }

class RecoveryCostModel:
    def __init__(
        self,
        alpha: float = 0.40,  # Goodput weight
        beta: float = 0.25,   # Latency penalty
        gamma: float = 0.20,  # Retransmission penalty
        delta: float = 0.15,  # Buffer occupancy penalty
        receiver_buffer_size: int = 24,
        seq_number_modulus: int = 64,
        max_window_size: int = 32,
    ):
        self.alpha = alpha
        self.beta = beta
        self.gamma = gamma
        self.delta = delta
        self.receiver_buffer_size = receiver_buffer_size
        self.seq_number_modulus = seq_number_modulus
        self.max_window_size = max_window_size

    def generate_candidate_windows(self, current_window: int, bdp_frames: int) -> List[int]:
        """Generate feasible candidate window sizes exploring exploration, steady state, and recovery."""
        safe_max = min(self.max_window_size, self.receiver_buffer_size, self.seq_number_modulus // 2)
        candidates = {
            1,
            2,
            4,
            max(1, current_window // 2),
            current_window,
            min(safe_max, current_window + 1),
            min(safe_max, current_window + 2),
            max(1, min(safe_max, bdp_frames)),
            safe_max,
        }
        return sorted(list(candidates))

    def evaluate_candidates(
        self,
        current_window: int,
        stats: Dict[str, Any],
        enable_burst_awareness: bool = True,
    ) -> List[CandidateEvaluation]:
        srtt = max(1.0, stats.get("srtt", 80.0))
        rttvar = max(0.5, stats.get("rttvar", 20.0))
        recent_loss = stats.get("recent_loss_rate", 0.05)
        channel_state = stats.get("channel_state", "GOOD")
        mean_burst = stats.get("mean_burst_length", 1.0)
        est_bw_kbps = max(100.0, stats.get("estimated_bandwidth_kbps", 3000.0))
        bdp = max(1, stats.get("bdp_frames", 4))

        safe_max_seq = self.seq_number_modulus // 2
        candidates = self.generate_candidate_windows(current_window, bdp)
        evaluations: List[CandidateEvaluation] = []

        is_bad_channel = (channel_state == "BAD" or stats.get("consecutive_losses", 0) >= 2)

        for w in candidates:
            # 1. Physical Feasibility Constraints
            is_feasible = True
            rejection_reason = None

            if w > self.receiver_buffer_size:
                is_feasible = False
                rejection_reason = f"Exceeds receiver buffer capacity ({self.receiver_buffer_size})"
            elif w > safe_max_seq:
                is_feasible = False
                rejection_reason = f"Violates sequence safety invariant W <= M/2 ({safe_max_seq})"

            # 2. Burst-Aware Loss Impact Model
            p_b2b = stats.get("p_bad_to_bad", 0.70)
            if enable_burst_awareness and is_bad_channel:
                burst_factor = 1.0 + 0.5 * mean_burst + (p_b2b / max(0.1, 1.0 - p_b2b)) * 0.25
                eff_loss = min(0.95, recent_loss * burst_factor)
                pred_retrans = w * eff_loss * (1.0 + 0.15 * mean_burst)
            else:
                eff_loss = min(0.95, recent_loss)
                pred_retrans = w * eff_loss
            # 3. Predicted Goodput (Kbps)
            # Pipe utilization ratio w / BDP
            pipe_util = min(1.0, w / float(bdp))
            pred_goodput = max(5.0, est_bw_kbps * pipe_util * (1.0 - eff_loss))

            # 4. Predicted P95 Latency (ms)
            # Queuing delay proportional to pipe overfill
            queuing_delay = max(0.0, (w - bdp) * (srtt / max(1, bdp)))
            recovery_latency = eff_loss * (srtt + 2.0 * rttvar)
            pred_latency = srtt + queuing_delay + recovery_latency

            # 5. Predicted Buffer Occupancy (frames)
            pred_buffer = min(self.receiver_buffer_size, round(w * (0.25 + eff_loss * 0.75)))

            # 7. Normalized Multi-Objective Utility Function J(w)
            norm_g = pred_goodput / est_bw_kbps
            norm_l = min(1.0, pred_latency / max(10.0, srtt * 3.0))
            norm_r = min(1.0, pred_retrans / max(1.0, float(w)))
            norm_b = pred_buffer / max(1.0, float(self.receiver_buffer_size))

            if is_feasible:
                score = (self.alpha * norm_g) - (self.beta * norm_l) - (self.gamma * norm_r) - (self.delta * norm_b)
            else:
                score = -999.0

            evaluations.append(
                CandidateEvaluation(
                    window_size=w,
                    predicted_goodput_kbps=pred_goodput,
                    predicted_p95_latency_ms=pred_latency,
                    predicted_retrans_cost=pred_retrans,
                    predicted_buffer_usage=pred_buffer,
                    score=score,
                    is_feasible=is_feasible,
                    rejection_reason=rejection_reason,
                )
            )

        # Sort feasible candidates by score descending
        evaluations.sort(key=lambda x: (x.is_feasible, x.score), reverse=True)
        return evaluations
