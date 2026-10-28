"""
Selective Repeat ARQ Protocol State Machine (Python Implementation)
Strictly enforces Ws + Wr <= M (Ws <= M // 2 for symmetric windows)
"""

from typing import Optional, Tuple, Dict, Any

class SelectiveRepeatSender:
    def __init__(self, total_frames: int, window_size: int = 8, modulus: int = 64, initial_rto_ms: float = 300.0):
        self.total_frames = total_frames
        self.modulus = modulus
        max_safe_window = modulus // 2
        self.window_size = min(window_size, max_safe_window)
        self.current_rto_ms = initial_rto_ms
        self.base_index = 0
        self.next_seq_index = 0
        self.frames: Dict[int, Dict[str, Any]] = {}
        self.retransmissions_count = 0
        self.is_completed = False

    def can_send(self) -> bool:
        if self.is_completed:
            return False
        # Any frame needing retransmission?
        for idx in range(self.base_index, self.next_seq_index):
            if self.frames.get(idx, {}).get("state") == "ready_to_send":
                return True
        # Or fresh frame within window?
        return (
            self.next_seq_index < self.total_frames
            and self.next_seq_index < self.base_index + self.window_size
        )

    def on_send(self, sim_time_ms: float) -> Optional[Dict[str, Any]]:
        if not self.can_send():
            return None

        # Priority 1: Retransmissions
        for idx in range(self.base_index, self.next_seq_index):
            entry = self.frames.get(idx)
            if entry and entry["state"] == "ready_to_send":
                entry["state"] = "sent_unacked"
                entry["timer_expires_at"] = sim_time_ms + self.current_rto_ms
                return {
                    "id": f"sr-f{idx}-s{entry['seq']}-retrans",
                    "frame_index": idx,
                    "seq_number": entry["seq"],
                    "type": "DATA",
                    "sent_at": sim_time_ms,
                    "is_retransmission": True,
                    "retransmissions": entry["retransmissions"],
                }

        # Priority 2: New frame
        if self.next_seq_index < self.total_frames and self.next_seq_index < self.base_index + self.window_size:
            idx = self.next_seq_index
            seq = idx % self.modulus
            entry = {
                "frame_index": idx,
                "seq": seq,
                "state": "sent_unacked",
                "timer_expires_at": sim_time_ms + self.current_rto_ms,
                "retransmissions": 0,
            }
            self.frames[idx] = entry
            self.next_seq_index += 1

            return {
                "id": f"sr-f{idx}-s{seq}",
                "frame_index": idx,
                "seq_number": seq,
                "type": "DATA",
                "sent_at": sim_time_ms,
                "is_retransmission": False,
                "retransmissions": 0,
            }

        return None

    def on_individual_ack(self, ack_seq: int, sim_time_ms: float) -> Tuple[bool, bool]:
        target_idx = None
        window_end = min(self.base_index + self.window_size, self.total_frames)
        for i in range(self.base_index, window_end):
            if i % self.modulus == ack_seq:
                target_idx = i
                break

        if target_idx is None or target_idx not in self.frames:
            return False, False

        entry = self.frames[target_idx]
        if entry["state"] == "acked":
            return False, False

        entry["state"] = "acked"
        old_base = self.base_index

        # Slide window over contiguous acked frames
        while self.base_index < self.total_frames:
            b_entry = self.frames.get(self.base_index)
            if b_entry and b_entry["state"] == "acked":
                self.frames.pop(self.base_index, None)
                self.base_index += 1
            else:
                break

        if self.base_index >= self.total_frames:
            self.is_completed = True

        return True, (self.base_index > old_base)

    def check_timeouts(self, sim_time_ms: float) -> int:
        if self.is_completed:
            return 0

        timed_out = 0
        for idx in range(self.base_index, self.next_seq_index):
            entry = self.frames.get(idx)
            if entry and entry["state"] == "sent_unacked":
                if sim_time_ms >= entry["timer_expires_at"]:
                    entry["state"] = "ready_to_send"
                    entry["retransmissions"] += 1
                    self.retransmissions_count += 1
                    timed_out += 1
        return timed_out


class SelectiveRepeatReceiver:
    def __init__(self, total_expected_frames: int, window_size: int = 8, modulus: int = 64):
        self.total_expected_frames = total_expected_frames
        self.modulus = modulus
        self.window_size = min(window_size, modulus // 2)
        self.base_index = 0
        self.total_delivered = 0
        self.buffer: Dict[int, Dict[str, Any]] = {}

    def on_frame_arrival(self, frame: Dict[str, Any], sim_time_ms: float) -> Tuple[bool, Dict[str, Any], int]:
        seq = frame.get("seq_number", 0)
        ack_frame = {
            "id": f"sr-ack-{seq}-{sim_time_ms}",
            "seq_number": seq,
            "ack_number": seq,
            "type": "ACK",
            "sent_at": sim_time_ms,
        }

        # Locate global index relative to base_index
        target_idx = None
        search_start = max(0, self.base_index - self.window_size)
        search_end = self.base_index + self.window_size
        for i in range(search_start, search_end):
            if i % self.modulus == seq:
                target_idx = i
                break

        if target_idx is None:
            return False, ack_frame, 0

        # Inside current receiver window [base_index ... base_index + window_size - 1]
        if self.base_index <= target_idx < self.base_index + self.window_size:
            if target_idx not in self.buffer:
                self.buffer[target_idx] = frame

            delivered_now = 0
            while self.base_index in self.buffer:
                self.buffer.pop(self.base_index)
                self.base_index += 1
                self.total_delivered += 1
                delivered_now += 1

            return True, ack_frame, delivered_now

        # Already delivered in the past
        return False, ack_frame, 0

    def is_transfer_complete(self) -> bool:
        return self.total_delivered >= self.total_expected_frames
