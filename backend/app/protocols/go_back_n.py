"""
Go-Back-N ARQ Protocol State Machine.
Handles cumulative ACKs, sliding sender window (Ws <= M - 1), sequence wraparound modulo M,
receiver strict in-order acceptance, timer rewind on timeout, and real data payload reconstruction.
"""

from typing import Optional, Tuple, List, Dict
import hashlib
from app.protocols.frame import Frame, FrameType, FrameStatus, compute_checksum

class GoBackNSender:
    def __init__(
        self,
        data_chunks: List[bytes],
        window_size: int = 4,
        modulus: int = 16,
        initial_rto_ms: float = 300.0,
    ):
        self.data_chunks = data_chunks
        self.total_frames = len(data_chunks)
        self.modulus = modulus
        # Standard GBN safety constraint: Window size <= Modulus - 1
        self.window_size = min(window_size, modulus - 1)
        self.current_rto_ms = initial_rto_ms

        self.base_index: int = 0         # Global index of oldest unacked frame
        self.next_seq_index: int = 0     # Global index of next frame to transmit
        self.timer_expires_at: Optional[float] = None
        self.in_flight: Dict[int, Frame] = {}  # global_index -> Frame
        self.retransmissions_count: int = 0
        self.is_completed: bool = (self.total_frames == 0)

    def set_window_size(self, new_size: int):
        self.window_size = max(1, min(new_size, self.modulus - 1))

    def can_send(self) -> bool:
        return (
            not self.is_completed
            and self.next_seq_index < self.total_frames
            and self.next_seq_index < self.base_index + self.window_size
        )

    def on_send(self, sim_time_ms: float) -> Optional[Frame]:
        if not self.can_send():
            return None

        idx = self.next_seq_index
        seq = idx % self.modulus
        payload = self.data_chunks[idx]

        # Check if this frame index was previously transmitted (retransmission during Go-Back rewind)
        existing_frame = self.in_flight.get(idx)
        is_retrans = (existing_frame is not None and existing_frame.retransmission_count > 0)
        retrans_num = existing_frame.retransmission_count if existing_frame else 0

        frame = Frame(
            frame_id=f"gbn-f{idx}-s{seq}-try{retrans_num}",
            seq_number=seq,
            frame_type=FrameType.DATA,
            frame_index=idx,
            payload=payload,
            sent_at=sim_time_ms,
            is_retransmission=is_retrans,
            retransmission_count=retrans_num,
        )
        frame.status = FrameStatus.IN_FLIGHT
        self.in_flight[idx] = frame

        # Start timer if this is the oldest unacknowledged frame
        if self.timer_expires_at is None:
            self.timer_expires_at = sim_time_ms + self.current_rto_ms

        self.next_seq_index += 1
        return frame

    def on_cumulative_ack(self, ack_frame: Frame, sim_time_ms: float) -> Tuple[bool, int]:
        """
        Processes cumulative ACK.
        Returns: (is_valid, frames_acknowledged_count)
        """
        if self.base_index >= self.total_frames:
            self.is_completed = True
            return False, 0

        ack_seq = ack_frame.ack_number
        if ack_seq is None:
            return False, 0

        # Scan active window [base_index ... next_seq_index - 1] to find matching sequence modulo M
        matched_index = None
        for i in range(self.base_index, self.next_seq_index):
            if (i % self.modulus) == ack_seq:
                matched_index = i
                break

        if matched_index is None:
            # Out-of-window duplicate or stale ACK
            return False, 0

        # Cumulative advancement: all frames from base_index up to matched_index are ACKed!
        acked_count = matched_index - self.base_index + 1
        for i in range(self.base_index, matched_index + 1):
            frame = self.in_flight.pop(i, None)
            if frame:
                frame.status = FrameStatus.ACKED
                frame.acked_at = sim_time_ms

        self.base_index = matched_index + 1

        if self.base_index == self.next_seq_index:
            # All transmitted frames are acknowledged: stop timer
            self.timer_expires_at = None
        else:
            # Still outstanding frames: restart timer for oldest remaining frame
            self.timer_expires_at = sim_time_ms + self.current_rto_ms

        if self.base_index >= self.total_frames:
            self.is_completed = True

        return True, acked_count

    def check_timeout(self, sim_time_ms: float) -> bool:
        """
        GBN timeout behavior:
        If timer expires for oldest unacked frame, rewind next_seq_index back to base_index
        and mark in-flight frames for retransmission.
        """
        if self.is_completed or self.timer_expires_at is None:
            return False

        if sim_time_ms >= self.timer_expires_at:
            rewind_from = self.next_seq_index
            self.next_seq_index = self.base_index  # Go-Back rewind
            self.timer_expires_at = sim_time_ms + self.current_rto_ms  # Restart timer

            # Increment retransmission counts for unacknowledged window
            for i in range(self.base_index, rewind_from):
                frame = self.in_flight.get(i)
                if frame:
                    frame.retransmission_count += 1
                    frame.is_retransmission = True
                    self.retransmissions_count += 1

            return True

        return False


class GoBackNReceiver:
    def __init__(self, total_expected_frames: int, modulus: int = 16):
        self.total_expected_frames = total_expected_frames
        self.modulus = modulus
        self.expected_seq = 0
        self.expected_index = 0
        self.total_delivered = 0
        self.received_chunks: List[bytes] = []
        self.last_ack_seq = (modulus - 1)  # Initially sentinel previous sequence

    def on_frame_arrival(self, frame: Frame, sim_time_ms: float) -> Tuple[bool, Optional[Frame], bool]:
        """
        GBN receiver accepts ONLY the strictly expected in-order sequence number.
        Any out-of-order frame is discarded, and receiver repeats ACK for the last in-order frame.
        Returns: (accepted, ack_frame, is_duplicate_or_out_of_order)
        """
        calc_csum = compute_checksum(frame.payload, frame.seq_number)
        if frame.is_corrupted or calc_csum != frame.checksum:
            return False, None, False

        is_expected = (frame.seq_number == self.expected_seq)

        if is_expected:
            self.received_chunks.append(frame.payload)
            self.total_delivered += 1
            self.last_ack_seq = frame.seq_number
            self.expected_index += 1
            self.expected_seq = (self.expected_seq + 1) % self.modulus

            ack = Frame(
                frame_id=f"gbn-ack-s{frame.seq_number}-{sim_time_ms:.1f}",
                seq_number=frame.seq_number,
                frame_type=FrameType.ACK,
                ack_number=frame.seq_number,
                sent_at=sim_time_ms,
            )
            ack.status = FrameStatus.ACK_IN_FLIGHT
            return True, ack, False
        else:
            # Out of order or duplicate frame: discard payload, re-send cumulative ACK for last good frame
            ack = Frame(
                frame_id=f"gbn-dup-ack-s{self.last_ack_seq}-{sim_time_ms:.1f}",
                seq_number=self.last_ack_seq,
                frame_type=FrameType.ACK,
                ack_number=self.last_ack_seq,
                sent_at=sim_time_ms,
                is_retransmission=True,
            )
            ack.status = FrameStatus.ACK_IN_FLIGHT
            return False, ack, True

    def is_transfer_complete(self) -> bool:
        return self.total_delivered >= self.total_expected_frames

    def get_reconstructed_data(self) -> bytes:
        return b"".join(self.received_chunks)

    def get_sha256(self) -> str:
        return hashlib.sha256(self.get_reconstructed_data()).hexdigest()
