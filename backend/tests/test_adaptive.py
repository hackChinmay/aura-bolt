"""
Automated Test Suite for AURA-BOLT Adaptive Controller and Recovery-Cost Optimizer.
Tests Jacobson-Karels RTT/RTO, Karn's algorithm, burst loss detection, candidate scoring,
buffer safety limits, closed-loop prediction verification, fallback safety policy,
and ablation experiments.
"""

import unittest
from app.adaptive.burst_detector import BurstDetectorAndRttEstimator
from app.adaptive.cost_model import RecoveryCostModel
from app.adaptive.controller import AuraBoltAdaptiveController
from app.adaptive.baselines import LossRateAdaptiveController
from app.simulation.engine import SimulationEngine
from app.experiments.benchmark import run_four_protocol_comparison, run_ablation_study

class TestJacobsonKarelsRttEstimator(unittest.TestCase):
    def test_initial_sample_and_rto_calculation(self):
        estimator = BurstDetectorAndRttEstimator(initial_rtt_ms=100.0, initial_rto_ms=300.0)
        # First sample: SRTT = sample, RTTVAR = sample / 2
        estimator.record_rtt_sample(80.0, is_retransmission=False)
        self.assertEqual(estimator.srtt, 80.0)
        self.assertEqual(estimator.rttvar, 40.0)
        # RTO = SRTT + 4 * RTTVAR = 80 + 160 = 240
        self.assertEqual(estimator.rto, 240.0)

    def test_subsequent_updates(self):
        estimator = BurstDetectorAndRttEstimator()
        estimator.record_rtt_sample(100.0)
        # Second sample with higher RTT
        estimator.record_rtt_sample(120.0)
        # alpha=0.125, beta=0.25
        # diff = |100 - 120| = 20
        # rttvar = 0.75 * 50 + 0.25 * 20 = 37.5 + 5.0 = 42.5
        # srtt = 0.875 * 100 + 0.125 * 120 = 87.5 + 15 = 102.5
        self.assertAlmostEqual(estimator.srtt, 102.5, places=1)
        self.assertAlmostEqual(estimator.rttvar, 42.5, places=1)

    def test_karns_algorithm_rejects_retransmissions(self):
        estimator = BurstDetectorAndRttEstimator(initial_rtt_ms=50.0)
        estimator.record_rtt_sample(50.0, is_retransmission=False)
        initial_srtt = estimator.srtt

        # Retransmitted frame sample must be IGNORED
        estimator.record_rtt_sample(999.0, is_retransmission=True)
        self.assertEqual(estimator.srtt, initial_srtt)
        self.assertEqual(estimator.sample_count, 1)

    def test_exponential_timeout_backoff(self):
        estimator = BurstDetectorAndRttEstimator(initial_rto_ms=200.0)
        estimator.on_timeout_backoff()
        self.assertEqual(estimator.rto, 300.0)  # 200 * 1.5
        estimator.on_timeout_backoff()
        self.assertEqual(estimator.rto, 450.0)  # 300 * 1.5


class TestBurstLossDetector(unittest.TestCase):
    def test_consecutive_losses_and_channel_state(self):
        detector = BurstDetectorAndRttEstimator()
        # Initial clear channel
        detector.record_transmission_outcome(True)
        detector.record_transmission_outcome(True)
        stats = detector.get_burst_statistics()
        self.assertEqual(stats["channel_state"], "GOOD")
        self.assertEqual(stats["consecutive_losses"], 0)

        # 2 consecutive losses trigger BAD state
        detector.record_transmission_outcome(False)
        detector.record_transmission_outcome(False)
        stats = detector.get_burst_statistics()
        self.assertEqual(stats["consecutive_losses"], 2)
        self.assertEqual(stats["channel_state"], "BAD")

        # Success clears consecutive losses
        detector.record_transmission_outcome(True)
        stats = detector.get_burst_statistics()
        self.assertEqual(stats["consecutive_losses"], 0)


class TestRecoveryCostModel(unittest.TestCase):
    def test_buffer_constraint_and_safety_invariant(self):
        # Modulus M = 16 (Safe max W <= 8), Receiver Buffer B = 10
        model = RecoveryCostModel(
            receiver_buffer_size=10,
            seq_number_modulus=16,
            max_window_size=32,
        )
        cands = model.generate_candidate_windows(current_window=4, bdp_frames=6)
        # All candidate window sizes must be <= 8 (modulus // 2)
        for w in cands:
            self.assertLessEqual(w, 8)

    def test_infeasible_candidate_rejection(self):
        model = RecoveryCostModel(receiver_buffer_size=6, seq_number_modulus=64)
        stats = {
            "srtt": 50.0,
            "rttvar": 10.0,
            "recent_loss_rate": 0.05,
            "channel_state": "GOOD",
            "mean_burst_length": 1.0,
            "estimated_bandwidth_kbps": 3000.0,
            "bdp_frames": 4,
        }
        evals = model.evaluate_candidates(current_window=4, stats=stats)
        for cand in evals:
            if cand.window_size > 6:
                self.assertFalse(cand.is_feasible)
                self.assertIsNotNone(cand.rejection_reason)


class TestClosedLoopAdaptiveController(unittest.TestCase):
    def test_closed_loop_decision_and_verification(self):
        controller = AuraBoltAdaptiveController(
            receiver_buffer_size=16,
            seq_number_modulus=32,
            decision_interval_ms=50.0,
        )
        stats = {
            "srtt": 60.0,
            "rttvar": 15.0,
            "rto": 120.0,
            "recent_loss_rate": 0.02,
            "channel_state": "GOOD",
            "consecutive_losses": 0,
            "mean_burst_length": 1.0,
            "bdp_frames": 8,
        }

        # Step 1-4: Evaluate and apply decision at t=0
        res1 = controller.evaluate(
            sim_time_ms=0.0,
            current_window=4,
            current_rto=150.0,
            stats=stats,
            measured_goodput_kbps=2000.0,
        )
        self.assertTrue(res1["decision_made"])
        self.assertGreaterEqual(res1["new_window"], 4)
        self.assertEqual(res1["new_rto"], 120.0)

        # Step 6-7: Next evaluation at t=60ms verifies previous decision
        res2 = controller.evaluate(
            sim_time_ms=60.0,
            current_window=res1["new_window"],
            current_rto=res1["new_rto"],
            stats=stats,
            measured_goodput_kbps=2200.0,
        )
        # Previous decision must now be verified
        first_dec = controller.decision_history[0]
        self.assertEqual(first_dec.status, "VERIFIED")
        self.assertIsNotNone(first_dec.observed_goodput_kbps)
        self.assertIsNotNone(first_dec.prediction_error_kbps)

    def test_safe_fallback_on_consecutive_failures(self):
        controller = AuraBoltAdaptiveController(decision_interval_ms=50.0)
        stats = {
            "srtt": 60.0,
            "rttvar": 15.0,
            "rto": 120.0,
            "recent_loss_rate": 0.10,
            "channel_state": "GOOD",
            "consecutive_losses": 0,
            "mean_burst_length": 1.0,
            "bdp_frames": 8,
        }

        # First expansion
        controller.evaluate(0.0, current_window=4, current_rto=150.0, stats=stats, measured_goodput_kbps=2500.0)
        # Severe collapse triggers revert (consecutive_fallbacks = 1)
        controller.evaluate(60.0, current_window=8, current_rto=150.0, stats=stats, measured_goodput_kbps=100.0)
        # Second severe collapse triggers revert (consecutive_fallbacks = 2)
        res_fb = controller.evaluate(120.0, current_window=8, current_rto=150.0, stats=stats, measured_goodput_kbps=100.0)

        # Triggers FALLBACK mode and window reduction
        self.assertEqual(res_fb["mode"], "FALLBACK")
        self.assertLess(res_fb["new_window"], 8)


class TestComparativeBenchmarkAndAblation(unittest.TestCase):
    def test_four_protocol_benchmark_execution(self):
        comp = run_four_protocol_comparison(loss_rate=0.06, delay_ms=25.0, jitter_ms=2.0, seed=101)
        results = comp["results"]
        self.assertEqual(len(results), 4)
        for r in results:
            self.assertTrue(r["integrity_verified"])
            self.assertGreater(r["goodput_kbps"], 0.0)

    def test_ablation_study_execution(self):
        ablation = run_ablation_study(seed=202)
        comparisons = ablation["ablation_comparisons"]
        self.assertEqual(len(comparisons), 2)
        # Both bursty channel and random channel evaluated honestly
        for c in comparisons:
            self.assertIn("burst_aware_on", c)
            self.assertIn("burst_aware_off", c)
            self.assertGreater(c["burst_aware_on"]["goodput_kbps"], 0.0)
            self.assertGreater(c["burst_aware_off"]["goodput_kbps"], 0.0)


if __name__ == "__main__":
    unittest.main()
