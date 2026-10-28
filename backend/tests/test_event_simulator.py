"""
Comprehensive Automated Test Suite for AURA-BOLT Backend Networking Engine.
Tests Discrete-Event Simulator, Stop-and-Wait, Go-Back-N, and Selective Repeat ARQ.
Verifies payload reconstruction, sequence wraparound, packet loss, ACK loss, timeouts,
and deterministic seed reproducibility.
"""

import unittest
import hashlib
from app.simulation.engine import SimulationEngine
from app.simulation.event_scheduler import EventScheduler, EventType
from app.protocols.stop_and_wait import StopAndWaitSender, StopAndWaitReceiver
from app.protocols.go_back_n import GoBackNSender, GoBackNReceiver
from app.protocols.selective_repeat import SelectiveRepeatSender, SelectiveRepeatReceiver
from app.protocols.frame import Frame, FrameType

SAMPLE_TEXT = (
    b"AURA-BOLT Protocol Framework Verification: In computer networks, ARQ protocols "
    b"provide reliable end-to-end data transfer across unreliable physical channels. "
    b"This sample text is divided into multiple sequential frames to verify that "
    b"Stop-and-Wait, Go-Back-N, and Selective Repeat accurately handle packet loss, "
    b"ACK loss, out-of-order arrivals, sequence wraparound, and bit-exact reconstruction."
)

class TestDiscreteEventScheduler(unittest.TestCase):
    def test_priority_ordering(self):
        scheduler = EventScheduler()
        # Schedule out of chronological order
        scheduler.schedule(50.0, EventType.TIMEOUT_CHECK, event_id="ev50")
        scheduler.schedule(10.0, EventType.DATA_ARRIVAL, event_id="ev10")
        scheduler.schedule(30.0, EventType.ACK_ARRIVAL, event_id="ev30")

        # Must pop strictly in ascending order: 10, 30, 50
        e1 = scheduler.pop_next()
        self.assertIsNotNone(e1)
        self.assertEqual(e1.event_id, "ev10")
        self.assertEqual(scheduler.current_time_ms, 10.0)

        e2 = scheduler.pop_next()
        self.assertIsNotNone(e2)
        self.assertEqual(e2.event_id, "ev30")
        self.assertEqual(scheduler.current_time_ms, 30.0)

        e3 = scheduler.pop_next()
        self.assertIsNotNone(e3)
        self.assertEqual(e3.event_id, "ev50")
        self.assertEqual(scheduler.current_time_ms, 50.0)

    def test_event_cancellation(self):
        scheduler = EventScheduler()
        scheduler.schedule(10.0, EventType.DATA_ARRIVAL, event_id="ev10")
        scheduler.schedule(20.0, EventType.TIMEOUT_CHECK, event_id="ev20")
        scheduler.cancel("ev10")

        # ev10 was cancelled, so first popped should be ev20 at t=20
        e = scheduler.pop_next()
        self.assertIsNotNone(e)
        self.assertEqual(e.event_id, "ev20")
        self.assertEqual(scheduler.current_time_ms, 20.0)


class TestStopAndWaitProtocol(unittest.TestCase):
    def test_clean_channel_reconstruction(self):
        engine = SimulationEngine(
            protocol="stop_and_wait",
            data_to_send=SAMPLE_TEXT,
            chunk_size=32,
            packet_loss_rate=0.0,
            ack_loss_rate=0.0,
            one_way_delay_ms=10.0,
            jitter_ms=0.0,
            random_seed=123,
        )
        res = engine.run_all()
        self.assertTrue(res["is_completed"])
        self.assertTrue(res["metrics"]["integrity_verified"])
        self.assertEqual(res["metrics"]["total_retransmissions"], 0)
        self.assertEqual(res["metrics"]["retransmission_ratio"], 0.0)
        self.assertEqual(res["metrics"]["original_sha256"], res["metrics"]["reconstructed_sha256"])

    def test_loss_and_retransmission(self):
        # 15% packet loss, 5% ACK loss
        engine = SimulationEngine(
            protocol="stop_and_wait",
            data_to_send=SAMPLE_TEXT,
            chunk_size=32,
            packet_loss_rate=0.15,
            ack_loss_rate=0.05,
            one_way_delay_ms=15.0,
            jitter_ms=2.0,
            initial_rto_ms=100.0,
            random_seed=42,
        )
        res = engine.run_all()
        self.assertTrue(res["is_completed"])
        self.assertTrue(res["metrics"]["integrity_verified"])
        # Under 15% loss, retransmissions must have occurred
        self.assertGreater(res["metrics"]["total_retransmissions"], 0)
        self.assertGreater(res["metrics"]["retransmission_ratio"], 0.0)

    def test_alternating_bit_wraparound(self):
        chunks = [f"Chunk-{i}".encode() for i in range(10)]
        sender = StopAndWaitSender(chunks)
        receiver = StopAndWaitReceiver(10)

        # Transmit all 10 chunks, verifying sequence numbers alternate 0, 1, 0, 1...
        for i in range(10):
            expected_seq = i % 2
            f = sender.on_send(i * 100.0)
            self.assertIsNotNone(f)
            self.assertEqual(f.seq_number, expected_seq)

            delivered, ack, is_dup = receiver.on_frame_arrival(f, i * 100.0 + 20.0)
            self.assertTrue(delivered)
            self.assertFalse(is_dup)
            self.assertEqual(ack.ack_number, expected_seq)

            valid, advanced = sender.on_ack_received(ack, i * 100.0 + 40.0)
            self.assertTrue(valid)
            self.assertTrue(advanced)

        self.assertTrue(receiver.is_transfer_complete())
        self.assertTrue(sender.is_completed)


class TestGoBackNProtocol(unittest.TestCase):
    def test_clean_channel_reconstruction(self):
        engine = SimulationEngine(
            protocol="go_back_n",
            data_to_send=SAMPLE_TEXT,
            chunk_size=32,
            window_size=4,
            modulus=16,
            packet_loss_rate=0.0,
            ack_loss_rate=0.0,
            one_way_delay_ms=15.0,
            jitter_ms=0.0,
            random_seed=77,
        )
        res = engine.run_all()
        self.assertTrue(res["is_completed"])
        self.assertTrue(res["metrics"]["integrity_verified"])
        self.assertEqual(res["metrics"]["total_retransmissions"], 0)

    def test_sequence_wraparound(self):
        # Small modulus M = 8. With 25 chunks, sequence numbers wrap around 3+ times.
        engine = SimulationEngine(
            protocol="go_back_n",
            data_to_send=SAMPLE_TEXT,
            chunk_size=16,  # ~24 chunks
            window_size=4,
            modulus=8,  # Wraps every 8 frames
            packet_loss_rate=0.08,
            ack_loss_rate=0.02,
            one_way_delay_ms=12.0,
            random_seed=999,
        )
        res = engine.run_all()
        self.assertTrue(res["is_completed"])
        self.assertTrue(res["metrics"]["integrity_verified"])

    def test_out_of_order_rejection_and_rewind(self):
        chunks = [b"A", b"B", b"C", b"D"]
        sender = GoBackNSender(chunks, window_size=3, modulus=8, initial_rto_ms=100.0)
        receiver = GoBackNReceiver(4, modulus=8)

        # Transmit frames 0, 1, 2
        f0 = sender.on_send(0.0)
        f1 = sender.on_send(5.0)
        f2 = sender.on_send(10.0)

        # Frame 0 is lost in transit!
        # Frame 1 arrives at receiver
        del1, ack1, is_rej1 = receiver.on_frame_arrival(f1, 25.0)
        self.assertFalse(del1)
        self.assertTrue(is_rej1)
        # GBN receiver repeats ACK for last accepted frame (initial sentinel 7)
        self.assertEqual(ack1.ack_number, 7)

        # Frame 2 arrives at receiver
        del2, ack2, is_rej2 = receiver.on_frame_arrival(f2, 30.0)
        self.assertFalse(del2)
        self.assertTrue(is_rej2)

        # At t=105, timeout triggers on sender's oldest unacked frame (frame 0)
        timed_out = sender.check_timeout(105.0)
        self.assertTrue(timed_out)
        self.assertEqual(sender.next_seq_index, 0)  # Rewound back to 0!
        self.assertEqual(sender.retransmissions_count, 3)  # Frames 0, 1, 2 marked for retransmission

        # Re-send frame 0
        f0_retry = sender.on_send(110.0)
        del0, ack0, _ = receiver.on_frame_arrival(f0_retry, 130.0)
        self.assertTrue(del0)
        self.assertEqual(ack0.ack_number, 0)

        # Sender processes ACK 0
        valid, count = sender.on_cumulative_ack(ack0, 150.0)
        self.assertTrue(valid)
        self.assertEqual(count, 1)
        self.assertEqual(sender.base_index, 1)


class TestSelectiveRepeatProtocol(unittest.TestCase):
    def test_clean_channel_reconstruction(self):
        engine = SimulationEngine(
            protocol="selective_repeat",
            data_to_send=SAMPLE_TEXT,
            chunk_size=32,
            window_size=4,
            modulus=16,
            packet_loss_rate=0.0,
            ack_loss_rate=0.0,
            one_way_delay_ms=15.0,
            random_seed=42,
        )
        res = engine.run_all()
        self.assertTrue(res["is_completed"])
        self.assertTrue(res["metrics"]["integrity_verified"])
        self.assertEqual(res["metrics"]["total_retransmissions"], 0)

    def test_out_of_order_buffering_and_in_order_delivery(self):
        chunks = [b"Zero", b"One", b"Two", b"Three"]
        sender = SelectiveRepeatSender(chunks, window_size=4, modulus=16, initial_rto_ms=100.0)
        receiver = SelectiveRepeatReceiver(4, window_size=4, modulus=16)

        f0 = sender.on_send(0.0)
        f1 = sender.on_send(5.0)
        f2 = sender.on_send(10.0)

        # Frame 0 is delayed. Frame 1 arrives first
        del1, ack1, count1 = receiver.on_frame_arrival(f1, 25.0)
        self.assertTrue(del1)
        self.assertEqual(count1, 0)  # Buffered out of order, not delivered to app yet
        self.assertIn(1, receiver.buffer)

        # Frame 2 arrives next
        del2, ack2, count2 = receiver.on_frame_arrival(f2, 30.0)
        self.assertTrue(del2)
        self.assertEqual(count2, 0)
        self.assertIn(2, receiver.buffer)

        # Now Frame 0 arrives!
        del0, ack0, count0 = receiver.on_frame_arrival(f0, 35.0)
        self.assertTrue(del0)
        # Arrival of 0 unblocks contiguous frames 0, 1, 2: delivers 3 frames at once!
        self.assertEqual(count0, 3)
        self.assertEqual(len(receiver.buffer), 0)
        self.assertEqual(receiver.total_delivered, 3)

        reconstructed = receiver.get_reconstructed_data()
        self.assertEqual(reconstructed, b"ZeroOneTwo")

    def test_window_safety_invariant_enforcement(self):
        # Modulus M = 16. Selective Repeat requires W <= M // 2 (i.e. W <= 8).
        # Requesting window 14 must be constrained to 8.
        sender = SelectiveRepeatSender([b"test"], window_size=14, modulus=16)
        self.assertEqual(sender.window_size, 8)
        receiver = SelectiveRepeatReceiver(1, window_size=14, modulus=16)
        self.assertEqual(receiver.window_size, 8)

    def test_high_loss_burst_reconstruction(self):
        # 20% burst loss on data channel, 5% on ACK channel
        engine = SimulationEngine(
            protocol="selective_repeat",
            data_to_send=SAMPLE_TEXT,
            chunk_size=24,
            window_size=6,
            modulus=16,
            packet_loss_rate=0.20,
            ack_loss_rate=0.05,
            loss_pattern="burst",
            one_way_delay_ms=20.0,
            jitter_ms=4.0,
            initial_rto_ms=150.0,
            random_seed=555,
        )
        res = engine.run_all()
        self.assertTrue(res["is_completed"])
        self.assertTrue(res["metrics"]["integrity_verified"])
        self.assertEqual(res["metrics"]["original_sha256"], res["metrics"]["reconstructed_sha256"])


class TestDeterministicReproducibility(unittest.TestCase):
    def test_identical_seed_produces_identical_results(self):
        engine1 = SimulationEngine(
            protocol="selective_repeat",
            data_to_send=SAMPLE_TEXT,
            chunk_size=32,
            window_size=4,
            packet_loss_rate=0.10,
            ack_loss_rate=0.05,
            loss_pattern="burst",
            random_seed=12345,
        )
        res1 = engine1.run_all()

        engine2 = SimulationEngine(
            protocol="selective_repeat",
            data_to_send=SAMPLE_TEXT,
            chunk_size=32,
            window_size=4,
            packet_loss_rate=0.10,
            ack_loss_rate=0.05,
            loss_pattern="burst",
            random_seed=12345,
        )
        res2 = engine2.run_all()

        # Both runs under seed 12345 must produce identical results
        self.assertEqual(res1["metrics"]["duration_ms"], res2["metrics"]["duration_ms"])
        self.assertEqual(res1["metrics"]["total_data_frames_sent"], res2["metrics"]["total_data_frames_sent"])
        self.assertEqual(res1["metrics"]["total_retransmissions"], res2["metrics"]["total_retransmissions"])
        self.assertEqual(res1["metrics"]["total_packets_lost"], res2["metrics"]["total_packets_lost"])
        self.assertEqual(res1["metrics"]["goodput_kbps"], res2["metrics"]["goodput_kbps"])
        self.assertEqual(res1["total_events"], res2["total_events"])


if __name__ == "__main__":
    unittest.main()
