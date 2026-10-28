"""
Automated Unit Tests for ARQ Protocols, Binary Packet Format, and Adaptive Controller
"""

import pytest
import struct
from app.protocols.stop_and_wait import StopAndWaitSender, StopAndWaitReceiver
from app.protocols.go_back_n import GoBackNSender, GoBackNReceiver
from app.protocols.selective_repeat import SelectiveRepeatSender, SelectiveRepeatReceiver
from app.transfer.packet_format import encode_packet, decode_packet, compute_internet_checksum, MSG_DATA, MSG_ACK

def test_stop_and_wait_normal_flow():
    sender = StopAndWaitSender(total_frames=3, initial_rto_ms=100)
    receiver = StopAndWaitReceiver(total_expected_frames=3)

    # Frame 0
    f0 = sender.on_send(0.0)
    assert f0 is not None
    assert f0["seq_number"] == 0
    delivered, ack0, dup = receiver.on_frame_arrival(f0, 20.0)
    assert delivered is True
    assert dup is False
    assert ack0["ack_number"] == 0

    valid, advanced = sender.on_ack_received(ack0["ack_number"], 40.0)
    assert valid is True
    assert advanced is True

    # Frame 1
    f1 = sender.on_send(45.0)
    assert f1 is not None
    assert f1["seq_number"] == 1
    delivered, ack1, dup = receiver.on_frame_arrival(f1, 65.0)
    assert delivered is True
    sender.on_ack_received(ack1["ack_number"], 85.0)

    # Frame 2 (alternating bit back to 0)
    f2 = sender.on_send(90.0)
    assert f2["seq_number"] == 0
    receiver.on_frame_arrival(f2, 110.0)
    sender.on_ack_received(0, 130.0)

    assert receiver.is_transfer_complete() is True
    assert sender.is_completed is True

def test_stop_and_wait_timeout_and_duplicate():
    sender = StopAndWaitSender(total_frames=2, initial_rto_ms=100)
    receiver = StopAndWaitReceiver(total_expected_frames=2)

    f0 = sender.on_send(0.0)
    # Simulate packet loss: receiver never gets f0
    # At t=105, timeout triggers
    assert sender.check_timeout(50.0) is False
    assert sender.check_timeout(105.0) is True
    assert sender.retransmissions_count == 1

    # Retransmit f0
    f0_retrans = sender.on_send(110.0)
    delivered, ack0, dup = receiver.on_frame_arrival(f0_retrans, 130.0)
    assert delivered is True
    assert dup is False

    # Simulate duplicate arrival of f0 (e.g. delayed duplicate in channel)
    delivered_dup, ack_dup, is_dup = receiver.on_frame_arrival(f0_retrans, 135.0)
    assert delivered_dup is False
    assert is_dup is True
    assert ack_dup["ack_number"] == 0

def test_go_back_n_cumulative_ack():
    sender = GoBackNSender(total_frames=5, window_size=4, modulus=16, initial_rto_ms=200)
    receiver = GoBackNReceiver(total_expected_frames=5, modulus=16)

    # Sender transmits frames 0, 1, 2
    f0 = sender.on_send(0.0)
    f1 = sender.on_send(5.0)
    f2 = sender.on_send(10.0)
    assert f0 and f1 and f2

    # Receiver receives 0 and 1
    receiver.on_frame_arrival(f0, 25.0)
    _, ack1, _ = receiver.on_frame_arrival(f1, 30.0)

    # Cumulative ACK 1 acknowledges both frame 0 and 1!
    valid, count = sender.on_cumulative_ack(1, 55.0)
    assert valid is True
    assert count == 2
    assert sender.base_index == 2

def test_go_back_n_out_of_order_discard():
    receiver = GoBackNReceiver(total_expected_frames=4, modulus=16)
    # Frame 0 is lost, frame 1 arrives out of order
    f1 = {"seq_number": 1}
    delivered, ack, is_discarded = receiver.on_frame_arrival(f1, 30.0)
    # GBN must reject frame 1 because it expects frame 0
    assert delivered is False
    assert is_discarded is True
    # Receiver repeats ACK for the last in-order frame (or sentinel)
    assert ack["ack_number"] == 15

def test_selective_repeat_out_of_order_buffering():
    sender = SelectiveRepeatSender(total_frames=5, window_size=4, modulus=16, initial_rto_ms=200)
    receiver = SelectiveRepeatReceiver(total_expected_frames=5, window_size=4, modulus=16)

    f0 = sender.on_send(0.0)
    f1 = sender.on_send(5.0)
    f2 = sender.on_send(10.0)

    # Frame 0 is delayed; frame 1 arrives first
    del1, ack1, count1 = receiver.on_frame_arrival(f1, 25.0)
    # Frame 1 is accepted into out-of-order buffer, but 0 frames delivered to app yet
    assert del1 is True
    assert count1 == 0
    assert len(receiver.buffer) == 1

    # Frame 2 arrives next
    del2, ack2, count2 = receiver.on_frame_arrival(f2, 30.0)
    assert del2 is True
    assert count2 == 0
    assert len(receiver.buffer) == 2

    # Now the missing frame 0 arrives!
    del0, ack0, count0 = receiver.on_frame_arrival(f0, 35.0)
    assert del0 is True
    # Frame 0 arrival allows delivering frames 0, 1, and 2 in order (3 frames delivered at once)
    assert count0 == 3
    assert len(receiver.buffer) == 0
    assert receiver.total_delivered == 3

def test_selective_repeat_window_safety_invariant():
    # Modulus M = 16. Selective Repeat requires W <= M // 2 (i.e. W <= 8)
    # If caller requests window 12, it must be capped at 8 to prevent aliasing
    sender = SelectiveRepeatSender(total_frames=20, window_size=12, modulus=16)
    assert sender.window_size == 8

def test_binary_packet_format_and_checksum():
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
    assert len(encoded) == 32 + len(payload)

    # Decode and verify
    result = decode_packet(encoded)
    assert result is not None
    header, decoded_payload, is_valid = result
    assert is_valid is True
    assert header["seq_number"] == 42
    assert header["ack_number"] == 10
    assert header["window_size"] == 16
    assert decoded_payload == payload

    # Test intentional single-bit corruption
    corrupted = bytearray(encoded)
    corrupted[35] ^= 0x01  # Flip one bit in payload
    corrupted_result = decode_packet(bytes(corrupted))
    assert corrupted_result is not None
    _, _, is_valid_after_flip = corrupted_result
    assert is_valid_after_flip is False  # Checksum detection caught bit flip!
