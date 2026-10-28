"""
Binary Packet Format for Real UDP File Transfer (Python Implementation)
32-Byte Header Format matching RFC 1071 Checksum and Big-Endian Network Byte Order
"""

import struct
import hashlib
from typing import Tuple, Optional

HEADER_FORMAT = "!HBBBBIIHHIHQ"
HEADER_SIZE = 32
MAGIC_NUMBER = 0x4142  # 'A', 'B' (AURA-BOLT)

# Message types
MSG_SYN = 1
MSG_SYN_ACK = 2
MSG_DATA = 3
MSG_ACK = 4
MSG_FIN = 5
MSG_FIN_ACK = 6
MSG_RST = 7

def compute_internet_checksum(data: bytes) -> int:
    """Compute 16-bit Internet Checksum (RFC 1071)."""
    if len(data) % 2 == 1:
        data += b'\x00'
    total = 0
    for i in range(0, len(data), 2):
        word = (data[i] << 8) + data[i + 1]
        total += word
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return (~total) & 0xFFFF

def encode_packet(
    version: int,
    msg_type: int,
    flags: int,
    seq_number: int,
    ack_number: int,
    window_size: int,
    session_id: int,
    timestamp_micros: int,
    payload: bytes = b"",
) -> bytes:
    payload_len = len(payload)
    # Pack with checksum = 0 initially
    header = struct.pack(
        HEADER_FORMAT,
        MAGIC_NUMBER,
        version,
        msg_type,
        flags,
        0,  # reserved
        seq_number,
        ack_number,
        window_size,
        payload_len,
        session_id,
        0,  # checksum
        timestamp_micros,
    )
    raw = header + payload
    csum = compute_internet_checksum(raw)
    
    # Re-pack with computed checksum
    header = struct.pack(
        HEADER_FORMAT,
        MAGIC_NUMBER,
        version,
        msg_type,
        flags,
        0,
        seq_number,
        ack_number,
        window_size,
        payload_len,
        session_id,
        csum,
        timestamp_micros,
    )
    return header + payload

def decode_packet(raw: bytes) -> Optional[Tuple[dict, bytes, bool]]:
    if len(raw) < HEADER_SIZE:
        return None

    unpacked = struct.unpack(HEADER_FORMAT, raw[:HEADER_SIZE])
    magic = unpacked[0]
    if magic != MAGIC_NUMBER:
        return None

    header = {
        "magic": magic,
        "version": unpacked[1],
        "msg_type": unpacked[2],
        "flags": unpacked[3],
        "seq_number": unpacked[5],
        "ack_number": unpacked[6],
        "window_size": unpacked[7],
        "payload_length": unpacked[8],
        "session_id": unpacked[9],
        "checksum": unpacked[10],
        "timestamp_micros": unpacked[11],
    }

    payload = raw[HEADER_SIZE : HEADER_SIZE + header["payload_length"]]

    # Verify checksum
    zeroed_header = struct.pack(
        HEADER_FORMAT,
        magic,
        header["version"],
        header["msg_type"],
        header["flags"],
        0,
        header["seq_number"],
        header["ack_number"],
        header["window_size"],
        header["payload_length"],
        header["session_id"],
        0,
        header["timestamp_micros"],
    )
    calc_csum = compute_internet_checksum(zeroed_header + payload)
    is_valid = (calc_csum == header["checksum"])

    return header, payload, is_valid

def calculate_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
