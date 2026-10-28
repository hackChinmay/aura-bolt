"""
Selective Repeat ARQ Protocol State Machine.
Strictly enforces window safety constraint: Ws + Wr <= M (Ws <= M // 2 for symmetric windows).
Implements individual retransmission timers, individual ACKs, out-of-order receiver buffering,
in-order upper-layer delivery, and bit-exact data reconstruction.
"""

from typing import Optional, Tuple, List, Dict
import hashlib
from app.protocols.frame import Frame, FrameType, FrameStatus, compute_checksum

class SREntry:
    __slots__ = ("frame_index", "seq_number", "payload", "state", "sent_at", "timer_expires_at", "retransmissions")

    def __init__(self, frame_index: int, seq_number: int, payload: bytes):
        self.frame_index = frame_index
        self.seq_number = seq_number
        self.payload = payload
        self.state = "READY_TO_SEND"  # 'READY_TO_SEND', 'SENT_UNACKED', 'ACKED'
        self.sent_at = 0.0
        self.timer_expires_at = 0.0
        self.retransmissions = 0

class SelectiveRepeatSender:
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
        # Strict safety condition: W <= M // 2
        max_safe_window = max(1, modulus // 2)
        self.window_size = min(window_size, max_safe_window)
        self.current_rto_ms = initial_rto_ms

        self.base_index: int = 0
        self.next_seq_index: int = 0
        self.entries: Dict[int, SREntry] = {}  # global_index -> SREntry
        self.retransmissions_count: int = 0
        self.is_completed: bool = (self.total_frames == 0)

    def set_window_size(self, new_size: int):
        max_safe = max(1, self.modulus // 2)
        self.window_size = max(1, min(new_size, max_safe))

    def can_send(self) -> bool:
        if self.is_completed:
            return False

        # 1. Any timed-out frame ready to retransmit?
        for idx in range(self.base_index, self.next_seq_index):
            entry = self.entries.get(idx)
            if entry and entry.state == "READY_TO_SEND":
                return True

        # 2. Can send fresh frame within window?
        return (
            self.next_seq_index < self.total_frames
            and self.next_seq_index < self.base_index + self.window_size
        )

    def on_send(self, sim_time_ms: float) -> Optional[Frame]:
        if not self.can_send():
            return None

        # Priority 1: Retransmit frames that experienced timeout
        for idx in range(self.base_index, self.next_seq_index):
            entry = self.entries.get(idx)
            if entry and entry.state == "READY_TO_SEND":
                entry.state = "SENT_UNACKED"
                entry.sent_at = sim_time_ms
                entry.timer_expires_at = sim_time_ms + self.current_rto_ms

                frame = Frame(
                    frame_id=f"sr-f{idx}-s{entry.seq_number}-try{entry.retransmissions}",
                    seq_number=entry.seq_number,
                    frame_type=FrameType.DATA,
                    frame_index=idx,
                    payload=entry.payload,
                    sent_at=sim_time_ms,
                    is_retransmission=True,
                    retransmission_count=entry.retransmissions,
                )
                frame.status = FrameStatus.IN_FLIGHT
                return frame

        # Priority 2: Transmit fresh frame
        if self.next_seq_index < self.total_frames and self.next_seq_index < self.base_index + self.window_size:
            idx = self.next_seq_index
            seq = idx % self.modulus
            payload = self.data_chunks[idx]

            entry = SREntry(idx, seq, payload)
            entry.state = "SENT_UNACKED"
            entry.sent_at = sim_time_ms
            entry.timer_expires_at = sim_time_ms + self.current_rto_ms
            self.entries[idx] = entry

            self.next_seq_index += 1

            frame = Frame(
                frame_id=f"sr-f{idx}-s{seq}-try0",
                seq_number=seq,
                frame_type=FrameType.DATA,
                frame_index=idx,
                payload=payload,
                sent_at=sim_time_ms,
                is_retransmission=False,
                retransmission_count=0,
            )
            frame.status = FrameStatus.IN_FLIGHT
            return frame

        return None

    def on_individual_ack(self, ack_frame: Frame, sim_time_ms: float) -> Tuple[bool, bool]:
        """
        Processes individual ACK for specific sequence number.
        Returns: (is_valid, has_advanced_base)
        """
        ack_seq = ack_frame.ack_number
        if ack_seq is None:
            return False, False

        # Locate frame in current sender window [base_index ... base_index + window_size - 1]
        window_end = min(self.base_index + self.window_size, self.total_frames)
        matched_idx = None
        for i in range(self.base_index, window_end):
            if (i % self.modulus) == ack_seq:
                matched_idx = i
                break

        if matched_idx is None or matched_idx not in self.entries:
            # Out-of-window duplicate ACK
            return False, False

        entry = self.entries[matched_idx]
        if entry.state == "ACKED":
            return False, False

        # Mark individual frame as acknowledged
        entry.state = "ACKED"
        old_base = self.base_index

        # Slide base_index over all consecutive acknowledged frames
        while self.base_index < self.total_frames:
            b_entry = self.entries.get(self.base_index)
            if b_entry and b_entry.state == "ACKED":
                self.entries.pop(self.base_index, None)
                self.base_index += 1
            else:
                break

        if self.base_index >= self.total_frames:
            self.is_completed = True

        return True, (self.base_index > old_base)

    def check_timeouts(self, sim_time_ms: float) -> int:
        """
        Checks individual timers for all active unacknowledged frames in window.
        Returns number of frames that timed out.
        """
        if self.is_completed:
            return 0

        timed_out_count = 0
        for idx in range(self.base_index, self.next_seq_index):
            entry = self.entries.get(idx)
            if entry and entry.state == "SENT_UNACKED":
                if sim_time_ms >= entry.timer_expires_at:
                    entry.state = "READY_TO_SEND"
                    entry.retransmissions += 1
                    self.retransmissions_count += 1
                    timed_out_count += 1

        return timed_out_count


class SelectiveRepeatReceiver:
    def __init__(self, total_expected_frames: int, window_size: int = 4, modulus: int = 16):
        self.total_expected_frames = total_expected_frames
        self.modulus = modulus
        max_safe = max(1, modulus // 2)
        self.window_size = min(window_size, max_safe)

        self.base_index: int = 0
        self.total_delivered: int = 0
        self.delivered_chunks: List[bytes] = []
        self.buffer: Dict[int, bytes] = {}  # global_index -> payload

    def on_frame_arrival(self, frame: Frame, sim_time_ms: float) -> Tuple[bool, Optional[Frame], int]:
        """
        Processes frame arrival at Selective Repeat receiver.
        Returns: (accepted, ack_frame, delivered_now_count)
        """
        calc_csum = compute_checksum(frame.payload, frame.seq_number)
        if frame.is_corrupted or calc_csum != frame.checksum:
            return False, None, 0

        # Map received frame sequence number to global index relative to base_index
        # Valid range: [base_index - window_size ... base_index + window_size - 1]
        target_idx = None
        search_start = max(0, self.base_index - self.window_size)
        search_end = self.base_index + self.window_size
        for i in range(search_start, search_end):
            if (i % self.modulus) == frame.seq_number:
                target_idx = i
                break

        if target_idx is None:
            # Completely out of bounds
            return False, None, 0

        # Always construct ACK for this frame sequence number
        ack = Frame(
            frame_id=f"sr-ack-s{frame.seq_number}-{sim_time_ms:.1f}",
            seq_number=frame.seq_number,
            frame_type=FrameType.ACK,
            ack_number=frame.seq_number,
            sent_at=sim_time_ms,
        )
        ack.status = FrameStatus.ACK_IN_FLIGHT

        # Case 1: Frame falls within current receiver window [base_index ... base_index + window_size - 1]
        if self.base_index <= target_idx < self.base_index + self.window_size:
            if target_idx not in self.buffer:
                self.buffer[target_idx] = frame.payload

            # In-order delivery: advance base_index past all contiguous buffered frames
            delivered_now = 0
            while self.base_index in self.buffer:
                chunk = self.buffer.pop(self.base_index)
                self.delivered_chunks.append(chunk)
                self.base_index += 1
                self.total_delivered += 1
                delivered_now += 1

            return True, ack, delivered_now

        # Case 2: Frame was already delivered in the past (target_idx < base_index)
        # Sender must have missed the earlier ACK; re-send ACK without re-delivering payload
        return False, ack, 0

    def is_transfer_complete(self) -> bool:
        return self.total_delivered >= self.total_expected_frames

    def get_reconstructed_data(self) -> bytes:
        return b"".join(self.delivered_chunks)

    def get_sha256(self) -> str:
        return hashlib.sha256(self.get_reconstructed_data()).hexdigest()
