"""
Frame data structures for ARQ Protocols and Network Simulation.
Carries real application payload, sequence numbers, checksums, and timing metadata.
"""

from enum import Enum
from typing import Optional
import hashlib

class FrameType(str, Enum):
    DATA = "DATA"
    ACK = "ACK"
    NACK = "NACK"

class FrameStatus(str, Enum):
    QUEUED = "QUEUED"
    IN_FLIGHT = "IN_FLIGHT"
    DELIVERED = "DELIVERED"
    LOST = "LOST"
    CORRUPTED = "CORRUPTED"
    ACK_IN_FLIGHT = "ACK_IN_FLIGHT"
    ACKED = "ACKED"
    ACK_LOST = "ACK_LOST"
    RETRANSMITTED = "RETRANSMITTED"

def compute_checksum(payload: bytes, seq: int) -> int:
    """16-bit simple checksum over payload and sequence number."""
    total = seq & 0xFFFF
    for byte in payload:
        total = (total + byte) & 0xFFFF
    return total

class Frame:
    def __init__(
        self,
        frame_id: str,
        seq_number: int,
        frame_type: FrameType = FrameType.DATA,
        ack_number: Optional[int] = None,
        frame_index: int = 0,
        payload: bytes = b"",
        sent_at: float = 0.0,
        is_retransmission: bool = False,
        retransmission_count: int = 0,
    ):
        self.frame_id = frame_id
        self.seq_number = seq_number
        self.ack_number = ack_number
        self.frame_type = frame_type
        self.frame_index = frame_index
        self.payload = payload
        self.payload_length = len(payload)
        self.checksum = compute_checksum(payload, seq_number)
        self.is_corrupted = False
        
        # Timing (in discrete simulation milliseconds)
        self.sent_at = sent_at
        self.arrived_at: Optional[float] = None
        self.acked_at: Optional[float] = None
        
        self.is_retransmission = is_retransmission
        self.retransmission_count = retransmission_count
        self.status = FrameStatus.QUEUED
        self.loss_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.frame_id,
            "seq_number": self.seq_number,
            "ack_number": self.ack_number,
            "type": self.frame_type.value,
            "frame_index": self.frame_index,
            "payload_length": self.payload_length,
            "checksum": hex(self.checksum),
            "sent_at": self.sent_at,
            "arrived_at": self.arrived_at,
            "acked_at": self.acked_at,
            "is_retransmission": self.is_retransmission,
            "retransmission_count": self.retransmission_count,
            "status": self.status.value,
            "loss_reason": self.loss_reason,
        }

    def __repr__(self) -> str:
        if self.frame_type == FrameType.DATA:
            return f"<DATA idx={self.frame_index} seq={self.seq_number} len={self.payload_length} retrans={self.retransmission_count}>"
        return f"<ACK ack={self.ack_number} for_seq={self.seq_number}>"
