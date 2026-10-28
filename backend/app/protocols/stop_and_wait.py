"""
Stop-and-Wait ARQ Protocol State Machine (Python Implementation)
"""

from typing import Optional, Tuple, Dict, Any

class StopAndWaitSender:
    def __init__(self, total_frames: int, initial_rto_ms: float = 300.0):
        self.total_frames = total_frames
        self.current_rto_ms = initial_rto_ms
        self.next_frame_index = 0
        self.is_completed = False
        self.retransmissions_count = 0
        
        # State: 'ready_to_send', 'sent_unacked', 'acked'
        self.current_state = 'ready_to_send'
        self.current_seq = 0
        self.timer_expires_at: Optional[float] = None
        self.last_sent_at: float = 0.0

    def can_send(self) -> bool:
        return not self.is_completed and self.current_state == 'ready_to_send'

    def on_send(self, sim_time_ms: float) -> Optional[Dict[str, Any]]:
        if not self.can_send():
            return None

        self.current_seq = self.next_frame_index % 2
        self.current_state = 'sent_unacked'
        self.last_sent_at = sim_time_ms
        self.timer_expires_at = sim_time_ms + self.current_rto_ms

        return {
            "id": f"saw-f{self.next_frame_index}-s{self.current_seq}",
            "seq_number": self.current_seq,
            "frame_index": self.next_frame_index,
            "type": "DATA",
            "sent_at": sim_time_ms,
            "retransmission_count": self.retransmissions_count,
        }

    def on_ack_received(self, ack_seq: int, sim_time_ms: float) -> Tuple[bool, bool]:
        if self.current_state != 'sent_unacked':
            return False, False

        if ack_seq == self.current_seq:
            self.current_state = 'ready_to_send'
            self.timer_expires_at = None
            self.next_frame_index += 1
            if self.next_frame_index >= self.total_frames:
                self.is_completed = True
            return True, True
        return False, False

    def check_timeout(self, sim_time_ms: float) -> bool:
        if self.is_completed or self.current_state != 'sent_unacked':
            return False

        if self.timer_expires_at is not None and sim_time_ms >= self.timer_expires_at:
            self.retransmissions_count += 1
            self.current_state = 'ready_to_send'
            self.timer_expires_at = None
            return True
        return False


class StopAndWaitReceiver:
    def __init__(self, total_expected_frames: int):
        self.total_expected_frames = total_expected_frames
        self.expected_seq = 0
        self.total_delivered = 0
        self.last_ack_seq = 1

    def on_frame_arrival(self, frame: Dict[str, Any], sim_time_ms: float) -> Tuple[bool, Dict[str, Any], bool]:
        seq = frame.get("seq_number", 0)
        is_expected = (seq == self.expected_seq)

        if is_expected:
            self.total_delivered += 1
            self.last_ack_seq = seq
            self.expected_seq = (self.expected_seq + 1) % 2
            ack_frame = {
                "id": f"saw-ack-{seq}-{sim_time_ms}",
                "seq_number": seq,
                "ack_number": seq,
                "type": "ACK",
                "sent_at": sim_time_ms,
            }
            return True, ack_frame, False
        else:
            # Duplicate frame: retransmit ACK for previous to unblock sender
            ack_frame = {
                "id": f"saw-dup-ack-{self.last_ack_seq}-{sim_time_ms}",
                "seq_number": self.last_ack_seq,
                "ack_number": self.last_ack_seq,
                "type": "ACK",
                "sent_at": sim_time_ms,
            }
            return False, ack_frame, True

    def is_transfer_complete(self) -> bool:
        return self.total_delivered >= self.total_expected_frames
