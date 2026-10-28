"""
Go-Back-N ARQ Protocol State Machine (Python Implementation)
"""

from typing import Optional, Tuple, Dict, Any

class GoBackNSender:
    def __init__(self, total_frames: int, window_size: int = 8, modulus: int = 64, initial_rto_ms: float = 300.0):
        self.total_frames = total_frames
        self.modulus = modulus
        self.window_size = min(window_size, modulus - 1)
        self.current_rto_ms = initial_rto_ms
        self.base_index = 0
        self.next_seq_index = 0
        self.timer_expires_at: Optional[float] = None
        self.in_flight: Dict[int, Dict[str, Any]] = {}
        self.retransmissions_count = 0
        self.is_completed = False

    def can_send(self) -> bool:
        return (
            not self.is_completed
            and self.next_seq_index < self.total_frames
            and self.next_seq_index < self.base_index + self.window_size
        )

    def on_send(self, sim_time_ms: float) -> Optional[Dict[str, Any]]:
        if not self.can_send():
            return None

        frame_idx = self.next_seq_index
        seq = frame_idx % self.modulus
        retrans = self.in_flight.get(frame_idx, {}).get("retransmissions", 0)

        frame = {
            "id": f"gbn-f{frame_idx}-s{seq}",
            "frame_index": frame_idx,
            "seq_number": seq,
            "type": "DATA",
            "sent_at": sim_time_ms,
            "retransmissions": retrans,
        }
        self.in_flight[frame_idx] = frame

        if self.timer_expires_at is None:
            self.timer_expires_at = sim_time_ms + self.current_rto_ms

        self.next_seq_index += 1
        return frame

    def on_cumulative_ack(self, ack_seq: int, sim_time_ms: float) -> Tuple[bool, int]:
        if self.base_index >= self.total_frames:
            self.is_completed = True
            return False, 0

        scan = self.base_index
        acked = 0
        while scan < self.next_seq_index:
            if scan % self.modulus == ack_seq:
                acked = scan - self.base_index + 1
                for i in range(self.base_index, scan + 1):
                    self.in_flight.pop(i, None)
                self.base_index = scan + 1

                if self.base_index == self.next_seq_index:
                    self.timer_expires_at = None
                else:
                    self.timer_expires_at = sim_time_ms + self.current_rto_ms

                if self.base_index >= self.total_frames:
                    self.is_completed = True
                return True, acked
            scan += 1

        return False, 0

    def check_timeout(self, sim_time_ms: float) -> bool:
        if self.is_completed or self.timer_expires_at is None:
            return False

        if sim_time_ms >= self.timer_expires_at:
            # Go back: rewind next_seq_index to base_index
            self.next_seq_index = self.base_index
            self.timer_expires_at = sim_time_ms + self.current_rto_ms
            for i in range(self.base_index, self.next_seq_index):
                if i in self.in_flight:
                    self.in_flight[i]["retransmissions"] += 1
                    self.retransmissions_count += 1
            return True
        return False


class GoBackNReceiver:
    def __init__(self, total_expected_frames: int, modulus: int = 64):
        self.total_expected_frames = total_expected_frames
        self.modulus = modulus
        self.expected_seq = 0
        self.total_delivered = 0
        self.last_ack_seq = (modulus - 1)

    def on_frame_arrival(self, frame: Dict[str, Any], sim_time_ms: float) -> Tuple[bool, Dict[str, Any], bool]:
        seq = frame.get("seq_number", 0)
        is_expected = (seq == self.expected_seq)

        if is_expected:
            self.total_delivered += 1
            self.last_ack_seq = seq
            self.expected_seq = (self.expected_seq + 1) % self.modulus
            ack_frame = {
                "id": f"gbn-ack-{seq}-{sim_time_ms}",
                "seq_number": seq,
                "ack_number": seq,
                "type": "ACK",
                "sent_at": sim_time_ms,
            }
            return True, ack_frame, False
        else:
            # Out of order: discard frame, retransmit last ACK
            ack_frame = {
                "id": f"gbn-dup-ack-{self.last_ack_seq}-{sim_time_ms}",
                "seq_number": self.last_ack_seq,
                "ack_number": self.last_ack_seq,
                "type": "ACK",
                "sent_at": sim_time_ms,
            }
            return False, ack_frame, True

    def is_transfer_complete(self) -> bool:
        return self.total_delivered >= self.total_expected_frames
