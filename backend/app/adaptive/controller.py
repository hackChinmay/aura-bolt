"""
AURA-BOLT Closed-Loop Adaptive Controller.
Implements 8-Step Closed-Loop (Observe -> Predict -> Select -> Apply -> Measure -> Verify -> Update -> Fallback),
Audit Decision Logging, and Safe Fallback Policies.
"""

from typing import Dict, Any, List, Optional
from app.adaptive.cost_model import RecoveryCostModel, CandidateEvaluation

class ControllerDecisionRecord:
    def __init__(
        self,
        decision_id: str,
        timestamp_ms: float,
        step: str,
        mode: str,
        previous_window: int,
        selected_window: int,
        previous_rto: float,
        selected_rto: float,
        inputs: Dict[str, Any],
        candidates: List[Dict[str, Any]],
        reason: str,
        expected_outcome: str,
        status: str = "AWAITING_VERIFICATION",
    ):
        self.decision_id = decision_id
        self.timestamp_ms = timestamp_ms
        self.step = step
        self.mode = mode
        self.previous_window = previous_window
        self.selected_window = selected_window
        self.previous_rto = previous_rto
        self.selected_rto = selected_rto
        self.inputs = inputs
        self.candidates = candidates
        self.reason = reason
        self.expected_outcome = expected_outcome
        self.status = status
        self.observed_goodput_kbps: Optional[float] = None
        self.prediction_error_kbps: Optional[float] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.decision_id,
            "timestamp": round(self.timestamp_ms, 1),
            "step": self.step,
            "mode": self.mode,
            "previous_window": self.previous_window,
            "selected_window": self.selected_window,
            "previous_rto": round(self.previous_rto, 1),
            "selected_rto": round(self.selected_rto, 1),
            "inputs": self.inputs,
            "candidates": self.candidates,
            "reason": self.reason,
            "expected_outcome": self.expected_outcome,
            "status": self.status,
            "observed_goodput_kbps": round(self.observed_goodput_kbps, 1) if self.observed_goodput_kbps is not None else None,
            "prediction_error_kbps": round(self.prediction_error_kbps, 1) if self.prediction_error_kbps is not None else None,
        }

class AuraBoltAdaptiveController:
    def __init__(
        self,
        alpha: float = 0.40,
        beta: float = 0.25,
        gamma: float = 0.20,
        delta: float = 0.15,
        receiver_buffer_size: int = 24,
        seq_number_modulus: int = 64,
        max_window_size: int = 32,
        enable_burst_awareness: bool = True,
        decision_interval_ms: float = 200.0,
    ):
        self.cost_model = RecoveryCostModel(
            alpha=alpha,
            beta=beta,
            gamma=gamma,
            delta=delta,
            receiver_buffer_size=receiver_buffer_size,
            seq_number_modulus=seq_number_modulus,
            max_window_size=max_window_size,
        )
        self.enable_burst_awareness = enable_burst_awareness
        self.decision_interval_ms = decision_interval_ms

        self.last_eval_time_ms: float = 0.0
        self.consecutive_fallbacks: int = 0
        self.pending_verification: Optional[ControllerDecisionRecord] = None
        self.decision_history: List[ControllerDecisionRecord] = []
        self.decision_counter: int = 0

    def evaluate(
        self,
        sim_time_ms: float,
        current_window: int,
        current_rto: float,
        stats: Dict[str, Any],
        measured_goodput_kbps: float,
    ) -> Dict[str, Any]:
        """
        Executes the 8-Step Adaptive Control Loop.
        Returns: {decision_made, new_window, new_rto, mode, decision_dict}
        """
        # Step 6 & 7: VERIFY & UPDATE previous decision if pending
        if self.pending_verification is not None:
            self.pending_verification.observed_goodput_kbps = measured_goodput_kbps
            pred_cand = next(
                (c for c in self.pending_verification.candidates if c["window_size"] == self.pending_verification.selected_window),
                None
            )
            predicted = pred_cand["predicted_goodput_kbps"] if pred_cand else measured_goodput_kbps
            error = abs(predicted - measured_goodput_kbps)
            self.pending_verification.prediction_error_kbps = error

            # Check if prediction failed significantly (>55% underperformance)
            if measured_goodput_kbps < (predicted * 0.45):
                self.pending_verification.status = "REVERTED"
                self.consecutive_fallbacks += 1
            else:
                self.pending_verification.status = "VERIFIED"
                self.consecutive_fallbacks = 0

            self.pending_verification = None

        # Check evaluation epoch boundary
        if (sim_time_ms - self.last_eval_time_ms) < self.decision_interval_ms and self.last_eval_time_ms > 0.0:
            return {
                "decision_made": False,
                "new_window": current_window,
                "new_rto": current_rto,
                "mode": "STEADY",
            }

        self.last_eval_time_ms = sim_time_ms
        self.decision_counter += 1

        # Step 1: OBSERVE
        recent_loss = stats.get("recent_loss_rate", 0.0)
        channel_state = stats.get("channel_state", "GOOD")
        consecutive_losses = stats.get("consecutive_losses", 0)
        is_bad_channel = (channel_state == "BAD" or consecutive_losses >= 2) if self.enable_burst_awareness else (recent_loss > 0.15)
        bdp = stats.get("bdp_frames", 4)

        # Step 2: PREDICT candidate scores
        evaluations = self.cost_model.evaluate_candidates(
            current_window=current_window,
            stats=stats,
            enable_burst_awareness=self.enable_burst_awareness,
        )
        feasible_cands = [e for e in evaluations if e.is_feasible]

        # Step 3: SELECT & Step 8: FALLBACK policy
        selected_window = current_window
        mode = "OPTIMAL"
        reason = ""
        expected_outcome = ""

        # Step 8: Fallback check
        if self.consecutive_fallbacks >= 2:
            mode = "FALLBACK"
            selected_window = max(1, current_window // 2)
            reason = f"Consecutive prediction verification failures ({self.consecutive_fallbacks}). Reverting to conservative safe window {selected_window}."
            expected_outcome = "Relieve channel pressure and stabilize pipe."
        elif self.enable_burst_awareness and (channel_state == "BAD" or consecutive_losses >= 2):
            mode = "CONSERVATIVE_RECOVERY"
            selected_window = max(1, min(3, current_window // 2))
            reason = (
                f"Gilbert-Elliott burst fade detected ({consecutive_losses} consecutive frame drops, BAD state, "
                f"P(B->B)={stats.get('p_bad_to_bad', 0.70):.2f}). Downsizing window from {current_window} to {selected_window} to avoid pipe flooding."
            )
            expected_outcome = "Limit in-flight dropped packets during active channel fade."
        elif (not self.enable_burst_awareness) and recent_loss > 0.15:
            mode = "CONSERVATIVE_RECOVERY"
            selected_window = max(1, current_window // 2)
            reason = f"Ablated mode: High scalar loss rate ({int(recent_loss*100)}%) detected. Shrinking window to {selected_window}."
            expected_outcome = "Reduce transmission rate."
        elif feasible_cands:
            best = feasible_cands[0]
            selected_window = best.window_size

            if selected_window > current_window:
                mode = "PROBING"
                reason = f"Channel in GOOD state with low loss ({int(recent_loss*100)}%) and available BDP ({bdp} frames). Increasing window from {current_window} to {selected_window}."
                expected_outcome = f"Improve pipe occupancy toward predicted goodput of {best.predicted_goodput_kbps} Kbps."
            elif selected_window < current_window:
                mode = "CONSERVATIVE_RECOVERY"
                reason = f"Objective optimizer identified higher recovery cost. Reducing window from {current_window} to {selected_window}."
                expected_outcome = f"Curtail retransmission overhead and lower P95 latency to {best.predicted_p95_latency_ms} ms."
            else:
                mode = "OPTIMAL"
                reason = f"Current window {current_window} maximizes multi-objective utility score ({best.score})."
                expected_outcome = "Maintain steady-state throughput."

        # Step 7: Adaptive RTO computation (Jacobson-Karels)
        selected_rto = stats.get("rto", current_rto)

        # Step 4: APPLY - create decision record
        decision = ControllerDecisionRecord(
            decision_id=f"dec-{self.decision_counter}",
            timestamp_ms=sim_time_ms,
            step="APPLY" if mode != "FALLBACK" else "FALLBACK",
            mode=mode,
            previous_window=current_window,
            selected_window=selected_window,
            previous_rto=current_rto,
            selected_rto=selected_rto,
            inputs={
                "srtt": stats.get("srtt", 80.0),
                "rttvar": stats.get("rttvar", 20.0),
                "recent_loss_rate": recent_loss,
                "consecutive_losses": consecutive_losses,
                "channel_state": channel_state,
                "bdp_frames": bdp,
                "measured_goodput_kbps": round(measured_goodput_kbps, 1),
            },
            candidates=[e.to_dict() for e in evaluations],
            reason=reason,
            expected_outcome=expected_outcome,
            status="AWAITING_VERIFICATION",
        )

        self.pending_verification = decision
        self.decision_history.append(decision)

        return {
            "decision_made": True,
            "new_window": selected_window,
            "new_rto": selected_rto,
            "mode": mode,
            "decision": decision.to_dict(),
        }

    def get_audit_trail(self) -> List[Dict[str, Any]]:
        return [d.to_dict() for d in self.decision_history]
