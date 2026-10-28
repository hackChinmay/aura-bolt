"""
Performance metrics calculations for ARQ protocols and Network Simulation.
Computes Goodput, Retransmission Ratio, Completion Time, and Latency percentiles.
"""

import math
from typing import List, Dict, Any, Optional

def calculate_percentile(sorted_values: List[float], percentile: float) -> float:
    if not sorted_values:
        return 0.0
    k = (len(sorted_values) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_values[int(k)]
    d0 = sorted_values[int(f)] * (c - k)
    d1 = sorted_values[int(c)] * (k - f)
    return round(d0 + d1, 2)

def calculate_metrics(
    total_payload_bytes_delivered: int,
    total_data_frames_sent: int,
    total_retransmissions: int,
    total_acks_sent: int,
    total_packets_lost: int,
    total_acks_lost: int,
    start_time_ms: float,
    end_time_ms: float,
    delivery_latencies_ms: List[float],
    original_sha256: str,
    reconstructed_sha256: str,
    header_overhead_bytes: int = 32,
) -> Dict[str, Any]:
    duration_ms = max(0.001, end_time_ms - start_time_ms)
    duration_sec = duration_ms / 1000.0

    # 1. Useful Goodput (bps and Kbps)
    useful_bits = total_payload_bytes_delivered * 8
    goodput_bps = useful_bits / duration_sec
    goodput_kbps = round(goodput_bps / 1000.0, 2)

    # 2. Transmission Throughput (including protocol overhead and retransmissions)
    total_bytes_on_wire = (total_data_frames_sent * (1024 + header_overhead_bytes)) + (total_acks_sent * header_overhead_bytes)
    total_wire_bits = total_bytes_on_wire * 8
    transmission_throughput_kbps = round((total_wire_bits / duration_sec) / 1000.0, 2)

    # 3. Retransmission Ratio
    retrans_ratio = round(total_retransmissions / total_data_frames_sent, 4) if total_data_frames_sent > 0 else 0.0

    # 4. Latency Statistics
    sorted_latencies = sorted(delivery_latencies_ms)
    mean_latency = round(sum(sorted_latencies) / len(sorted_latencies), 2) if sorted_latencies else 0.0
    median_latency = calculate_percentile(sorted_latencies, 50.0)
    p95_latency = calculate_percentile(sorted_latencies, 95.0)
    p99_latency = calculate_percentile(sorted_latencies, 99.0)
    min_latency = sorted_latencies[0] if sorted_latencies else 0.0
    max_latency = sorted_latencies[-1] if sorted_latencies else 0.0

    stddev_latency = 0.0
    if len(sorted_latencies) > 1:
        variance = sum((x - mean_latency) ** 2 for x in sorted_latencies) / (len(sorted_latencies) - 1)
        stddev_latency = round(math.sqrt(variance), 2)

    # 5. File Integrity
    integrity_verified = (original_sha256 == reconstructed_sha256 and len(original_sha256) > 0)

    return {
        "duration_ms": round(duration_ms, 2),
        "goodput_kbps": goodput_kbps,
        "transmission_throughput_kbps": transmission_throughput_kbps,
        "total_data_frames_sent": total_data_frames_sent,
        "total_retransmissions": total_retransmissions,
        "retransmission_ratio": retrans_ratio,
        "total_acks_sent": total_acks_sent,
        "total_packets_lost": total_packets_lost,
        "total_acks_lost": total_acks_lost,
        "total_payload_bytes_delivered": total_payload_bytes_delivered,
        "latency_stats": {
            "mean_ms": mean_latency,
            "median_ms": median_latency,
            "p95_ms": p95_latency,
            "p99_ms": p99_latency,
            "min_ms": min_latency,
            "max_ms": max_latency,
            "stddev_ms": stddev_latency,
        },
        "original_sha256": original_sha256,
        "reconstructed_sha256": reconstructed_sha256,
        "integrity_verified": integrity_verified,
    }
