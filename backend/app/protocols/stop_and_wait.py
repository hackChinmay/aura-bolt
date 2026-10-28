"""
Stop-and-Wait ARQ Protocol State Machine (Alternating Bit Protocol).
Handles real data payloads, checksum validation, timeout retransmissions, duplicate frames, and sequence wraparound (modulo 2).
"""

from typing import Optional, Tuple, List, Dict
import hashlib
from app.protocols.frame import Frame, FrameType, FrameStatus, compute_checksum

class StopAndWaitSender:
    def __init__(self, data_chunks: List[bytes], initial_rto_ms: float = 300.0):
        self.data_chunks = data_chunks
        self.total_frames = len(data_chunks)
        self.current_rto_ms = initial_rto_ms
        self.next_chunk_index = 0
        self.current_seq = 0  # Alternating bit: 0 or 1
        
        # State: 'READY_TO_SEND', 'WAITING_FOR_ACK'
        self.state = "READY_TO_SEND"
        self.current_frame: Optional[Frame] = None
        self.timer_expires_at: Optional[float] = None
        self.retransmissions_count = 0
        self.is_completed = (self.total_frames == 0)

    def can_send(self) -> bool:
        return not self.is_completed and self.state == "READY_TO_SEND" and self.next_chunk_index < self.total_frames

    def on_send(self, sim_time_ms: float) -> Optional[Frame]:
        if not self.can_send():
            return None

        payload = self.data_chunks[self.next_chunk_index]
        is_retrans = (self.current_frame is not None and self.current_frame.frame_index == self.next_chunk_index)
        retrans_num = self.current_frame.retransmission_count if is_retrans else 0

        frame = Frame(
            frame_id=f"saw-f{self.next_chunk_index}-s{self.current_seq}-try{retrans_num}",
            seq_number=self.current_seq,
            frame_type=FrameType.DATA,
            frame_index=self.next_chunk_index,
            payload=payload,
            sent_at=sim_time_ms,
            is_retransmission=is_retrans,
            retransmission_count=retrans_num,
        )
        frame.status = FrameStatus.IN_FLIGHT

        self.current_frame = frame
        self.state = "WAITING_FOR_ACK"
        self.timer_expires_at = sim_time_ms + self.current_rto_ms
        return frame

    def on_ack_received(self, ack_frame: Frame, sim_time_ms: float) -> Tuple[bool, bool]:
        """
        Processes received ACK.
        Returns: (is_valid, has_advanced)
        """
        if self.state != "WAITING_FOR_ACK" or self.current_frame is None:
            return False, False

        # In Alternating-Bit Stop-and-Wait, ACK carries the sequence number of the acknowledged frame
        if ack_frame.ack_number == self.current_seq:
            self.current_frame.status = FrameStatus.ACKED
            self.current_frame.acked_at = sim_time_ms
            self.timer_expires_at = None
            self.next_chunk_index += 1
            self.current_seq = (self.current_seq + 1) % 2  # Modulo 2 sequence toggle
            self.state = "READY_TO_SEND"

            if self.next_chunk_index >= self.total_frames:
                self.is_completed = True

            return True, True

        return False, False

    def check_timeout(self, sim_time_ms: float) -> bool:
        """
        Checks if RTO has expired for the unacknowledged frame.
        If expired, transitions to READY_TO_SEND to trigger retransmission.
        """
        if self.is_completed or self.state != "WAITING_FOR_ACK" or self.timer_expires_at is None:
            return False

        if sim_time_ms >= self.timer_expires_at:
            self.retransmissions_count += 1
            if self.current_frame:
                self.current_frame.retransmission_count += 1
                self.current_frame.is_retransmission = True
            self.state = "READY_TO_SEND"
            self.timer_expires_at = None
            return True

        return False


class StopAndWaitReceiver:
    def __init__(self, total_expected_frames: int):
        self.total_expected_frames = total_expected_frames
        self.expected_seq = 0  # Alternating bit: 0 or 1
        self.total_delivered = 0
        self.received_chunks: List[bytes] = []
        self.last_ack_seq = 1  # Previous acknowledged sequence bit

    def on_frame_arrival(self, frame: Frame, sim_time_ms: float) -> Tuple[bool, Optional[Frame], bool]:
        """
        Process incoming frame at receiver.
        Returns: (accepted, ack_frame, is_duplicate)
        """
        # Validate checksum
        calc_csum = compute_checksum(frame.payload, frame.seq_number)
        if frame.is_corrupted or calc_csum != frame.checksum:
            # Corrupted frame: silently drop
            return False, None, False

        is_expected = (frame.seq_number == self.expected_seq)

        if is_expected:
            self.received_chunks.append(frame.payload)
            self.total_delivered += 1
            self.last_ack_seq = frame.seq_number
            self.expected_seq = (self.expected_seq + 1) % 2

            ack = Frame(
                frame_id=f"saw-ack-s{frame.seq_number}-{sim_time_ms:.1f}",
                seq_number=frame.seq_number,
                frame_type=FrameType.ACK,
                ack_number=frame.seq_number,
                sent_at=sim_time_ms,
            )
            ack.status = FrameStatus.ACK_IN_FLIGHT
            return True, ack, False
        else:
            # Duplicate frame: sender retransmitted because ACK was delayed or lost.
            # Re-send ACK for the last successfully received frame to unblock sender.
            ack = Frame(
                frame_id=f"saw-dup-ack-s{self.last_ack_seq}-{sim_time_ms:.1f}",
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
