"""
Automated Unit Tests for ARQ Protocols and Binary Packet Format (Standard unittest).
"""

import unittest
from app.protocols.stop_and_wait import StopAndWaitSender, StopAndWaitReceiver
from app.protocols.go_back_n import GoBackNSender, GoBackNReceiver
from app.protocols.selective_repeat import SelectiveRepeatSender, SelectiveRepeatReceiver
from app.transfer.packet_format import encode_packet, decode_packet, MSG_DATA, MSG_ACK

class TestProtocolPrimitives(unittest.TestCase):
    def test_stop_and_wait_normal_flow(self):
        chunks = [b"Chunk0", b"Chunk1", b"Chunk2"]
        sender = StopAndWaitSender(data_chunks=chunks, initial_rto_ms=100.0)
        receiver = StopAndWaitReceiver(total_expected_frames=3)

        # Frame 0
        f0 = sender.on_send(0.0)
        self.assertIsNotNone(f0)
        self.assertEqual(f0.seq_number, 0)
        delivered, ack0, dup = receiver.on_frame_arrival(f0, 20.0)
        self.assertTrue(delivered)
        self.assertFalse(dup)
        self.assertEqual(ack0.ack_number, 0)

        valid, advanced = sender.on_ack_received(ack0, 40.0)
        self.assertTrue(valid)
        self.assertTrue(advanced)

        # Frame 1
        f1 = sender.on_send(45.0)
        self.assertIsNotNone(f1)
        self.assertEqual(f1.seq_number, 1)
        delivered, ack1, dup = receiver.on_frame_arrival(f1, 65.0)
        self.assertTrue(delivered)
        sender.on_ack_received(ack1, 85.0)

        # Frame 2 (alternating bit back to 0)
        f2 = sender.on_send(90.0)
        self.assertEqual(f2.seq_number, 0)
        delivered2, ack2, _ = receiver.on_frame_arrival(f2, 110.0)
        self.assertTrue(delivered2)
        sender.on_ack_received(ack2, 130.0)

        self.assertTrue(receiver.is_transfer_complete())
        self.assertTrue(sender.is_completed)
        self.assertEqual(receiver.get_reconstructed_data(), b"Chunk0Chunk1Chunk2")

    def test_stop_and_wait_timeout_and_duplicate(self):
        chunks = [b"Frame0", b"Frame1"]
        sender = StopAndWaitSender(data_chunks=chunks, initial_rto_ms=100.0)
        receiver = StopAndWaitReceiver(total_expected_frames=2)

        f0 = sender.on_send(0.0)
        # Simulate packet loss: receiver never gets f0
        # At t=105, timeout triggers
        self.assertFalse(sender.check_timeout(50.0))
        self.assertTrue(sender.check_timeout(105.0))
        self.assertEqual(sender.retransmissions_count, 1)

        # Retransmit f0
        f0_retrans = sender.on_send(110.0)
        delivered, ack0, dup = receiver.on_frame_arrival(f0_retrans, 130.0)
        self.assertTrue(delivered)
        self.assertFalse(dup)

        # Simulate duplicate arrival of f0 (delayed duplicate in channel)
        delivered_dup, ack_dup, is_dup = receiver.on_frame_arrival(f0_retrans, 135.0)
        self.assertFalse(delivered_dup)
        self.assertTrue(is_dup)
        self.assertEqual(ack_dup.ack_number, 0)

    def test_go_back_n_cumulative_ack(self):
        chunks = [b"A", b"B", b"C", b"D", b"E"]
        sender = GoBackNSender(data_chunks=chunks, window_size=4, modulus=16, initial_rto_ms=200.0)
        receiver = GoBackNReceiver(total_expected_frames=5, modulus=16)

        # Sender transmits frames 0, 1, 2
        f0 = sender.on_send(0.0)
        f1 = sender.on_send(5.0)
        f2 = sender.on_send(10.0)
        self.assertTrue(f0 and f1 and f2)

        # Receiver receives 0 and 1
        receiver.on_frame_arrival(f0, 25.0)
        _, ack1, _ = receiver.on_frame_arrival(f1, 30.0)

        # Cumulative ACK 1 acknowledges both frame 0 and 1!
        valid, count = sender.on_cumulative_ack(ack1, 55.0)
        self.assertTrue(valid)
        self.assertEqual(count, 2)
        self.assertEqual(sender.base_index, 2)

    def test_go_back_n_out_of_order_discard(self):
        chunks = [b"F0", b"F1", b"F2"]
        sender = GoBackNSender(data_chunks=chunks, window_size=3, modulus=16)
        receiver = GoBackNReceiver(total_expected_frames=3, modulus=16)

        # Frame 0 is lost, frame 1 arrives out of order
        sender.on_send(0.0)
        f1 = sender.on_send(5.0)
        delivered, ack, is_discarded = receiver.on_frame_arrival(f1, 30.0)
        # GBN must reject frame 1 because it expects frame 0
        self.assertFalse(delivered)
        self.assertTrue(is_discarded)
        # Receiver repeats ACK for the last in-order frame (sentinel 15)
        self.assertEqual(ack.ack_number, 15)

    def test_selective_repeat_out_of_order_buffering(self):
        chunks = [b"P0", b"P1", b"P2", b"P3"]
        sender = SelectiveRepeatSender(data_chunks=chunks, window_size=4, modulus=16, initial_rto_ms=200.0)
        receiver = SelectiveRepeatReceiver(total_expected_frames=4, window_size=4, modulus=16)

        f0 = sender.on_send(0.0)
        f1 = sender.on_send(5.0)
        f2 = sender.on_send(10.0)

        # Frame 0 is delayed; frame 1 arrives first
        del1, ack1, count1 = receiver.on_frame_arrival(f1, 25.0)
        self.assertTrue(del1)
        self.assertEqual(count1, 0)
        self.assertEqual(len(receiver.buffer), 1)

        # Frame 2 arrives next
        del2, ack2, count2 = receiver.on_frame_arrival(f2, 30.0)
        self.assertTrue(del2)
        self.assertEqual(count2, 0)
        self.assertEqual(len(receiver.buffer), 2)

        # Now the missing frame 0 arrives!
        del0, ack0, count0 = receiver.on_frame_arrival(f0, 35.0)
        self.assertTrue(del0)
        # Frame 0 arrival allows delivering frames 0, 1, and 2 in order (3 frames delivered at once)
        self.assertEqual(count0, 3)
        self.assertEqual(len(receiver.buffer), 0)
        self.assertEqual(receiver.total_delivered, 3)
        self.assertEqual(receiver.get_reconstructed_data(), b"P0P1P2")

    def test_selective_repeat_window_safety_invariant(self):
        # Modulus M = 16. Selective Repeat requires W <= M // 2 (i.e. W <= 8)
        sender = SelectiveRepeatSender([b"data"] * 10, window_size=12, modulus=16)
        self.assertEqual(sender.window_size, 8)

    def test_binary_packet_format_and_checksum(self):
        payload = b"Hello, AURA-BOLT Protocol Research Team!"
        encoded = encode_packet(
            version=1,
            msg_type=MSG_DATA,
            flags=0,
            seq_number=42,
            ack_number=10,
            window_size=16,
            session_id=9999,
            timestamp_micros=123456789,
            payload=payload,
        )
        self.assertEqual(len(encoded), 32 + len(payload))

        result = decode_packet(encoded)
        self.assertIsNotNone(result)
        header, decoded_payload, is_valid = result
        self.assertTrue(is_valid)
        self.assertEqual(header["seq_number"], 42)
        self.assertEqual(header["ack_number"], 10)
        self.assertEqual(header["window_size"], 16)
        self.assertEqual(decoded_payload, payload)

        # Flip one bit in payload to test checksum detection
        corrupted = bytearray(encoded)
        corrupted[35] ^= 0x01
        corrupted_result = decode_packet(bytes(corrupted))
        self.assertIsNotNone(corrupted_result)
        _, _, is_valid_after_flip = corrupted_result
        self.assertFalse(is_valid_after_flip)

if __name__ == "__main__":
    unittest.main()
