#!/usr/bin/env python3
"""
Demonstration script for AURA-BOLT Backend Networking Engine.
Executes Stop-and-Wait, Go-Back-N, and Selective Repeat ARQ under identical network impairment seeds,
showing full metrics calculation and bit-exact data reconstruction verification.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.simulation.engine import SimulationEngine

SAMPLE_PAYLOAD = (
    b"AURA-BOLT Protocol Research Benchmark: Demonstrating reliable data transfer "
    b"over lossy, jittery channels. Each protocol must reconstruct this byte stream "
    b"with 100% bit-exact fidelity, verified via SHA-256 cryptographic hashes."
)

def run_protocol_demo(protocol_name: str, loss_rate: float = 0.08, jitter_ms: float = 4.0, seed: int = 42):
    print(f"\n=======================================================")
    print(f" PROTOCOL: {protocol_name.upper()} (Loss={int(loss_rate*100)}%, Jitter={jitter_ms}ms, Seed={seed})")
    print(f"=======================================================")

    engine = SimulationEngine(
        protocol=protocol_name,
        data_to_send=SAMPLE_PAYLOAD,
        chunk_size=24,
        window_size=4,
        modulus=16,
        one_way_delay_ms=25.0,
        jitter_ms=jitter_ms,
        packet_loss_rate=loss_rate,
        ack_loss_rate=0.02,
        loss_pattern="burst",
        initial_rto_ms=180.0,
        random_seed=seed,
    )

    result = engine.run_all()
    metrics = result["metrics"]

    print(f"Status:                {'COMPLETED' if result['is_completed'] else 'FAILED'}")
    print(f"Virtual Sim Duration:  {metrics['duration_ms']:.1f} ms")
    print(f"Useful Goodput:        {metrics['goodput_kbps']:.1f} Kbps")
    print(f"Transmission Thput:    {metrics['transmission_throughput_kbps']:.1f} Kbps")
    print(f"Total Frames Sent:     {metrics['total_data_frames_sent']} (Retrans: {metrics['total_retransmissions']})")
    print(f"Retransmission Ratio:  {metrics['retransmission_ratio']*100:.1f}%")
    print(f"Packets Dropped:       {metrics['total_packets_lost']} data, {metrics['total_acks_lost']} ACKs")
    print(f"Delivery Latencies:    Mean={metrics['latency_stats']['mean_ms']}ms, P95={metrics['latency_stats']['p95_ms']}ms")
    print(f"Original SHA-256:      {metrics['original_sha256']}")
    print(f"Reconstructed SHA-256: {metrics['reconstructed_sha256']}")
    print(f"Integrity Verified:    {metrics['integrity_verified']} (Bit-exact match)")

    assert metrics["integrity_verified"] is True, f"Integrity failed for {protocol_name}"

if __name__ == "__main__":
    print("Executing AURA-BOLT Backend Networking Engine Demonstration...")
    for proto in ["stop_and_wait", "go_back_n", "selective_repeat"]:
        run_protocol_demo(proto, loss_rate=0.08, jitter_ms=4.0, seed=42)
    print("\nAll ARQ protocols successfully executed and verified!")
