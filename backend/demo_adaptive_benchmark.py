#!/usr/bin/env python3
"""
AURA-BOLT Adaptive Controller Demonstration & Ablation Benchmark.
Executes:
1. 4-Way Comparison: Fixed GBN vs Fixed SR vs Simple Loss-Rate Adaptive vs AURA-BOLT.
2. Ablation Analysis: Burst Awareness ON vs OFF on Burst-Loss vs Bernoulli Channels.
3. Closed-Loop Decision Audit Inspection: Observe -> Predict -> Select -> Apply -> Measure -> Verify -> Fallback.
"""

import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from app.experiments.benchmark import run_four_protocol_comparison, run_ablation_study
from app.simulation.engine import SimulationEngine

SAMPLE_DATA = (
    b"AURA-BOLT Adaptive Controller Empirical Benchmark: "
    b"Evaluating sliding-window optimization, recovery cost estimation, "
    b"and Gilbert-Elliott burst correlation across dynamic channel impairments."
) * 6

def display_four_protocol_comparison():
    print("\n" + "=" * 70)
    print(" PART 1: FOUR-PROTOCOL COMPARATIVE BENCHMARK")
    print("=" * 70)
    print("Conditions: 8% packet loss, 30ms one-way delay (60ms RTT), 4ms jitter, Seed=1234")

    comp = run_four_protocol_comparison(loss_rate=0.08, delay_ms=30.0, jitter_ms=4.0, seed=1234)
    results = comp["results"]

    print(f"\n{'Protocol':<28} | {'Goodput':<12} | {'Retrans %':<10} | {'P95 Latency':<12} | {'Decisions'}")
    print("-" * 75)
    for r in results:
        goodput_str = f"{r['goodput_kbps']:.1f} Kbps"
        retrans_str = f"{r['retransmission_ratio']*100:.1f}%"
        lat_str = f"{r['p95_latency_ms']:.1f} ms"
        dec_str = f"{r['decisions_count']} steps" if r['decisions_count'] > 0 else "Static"
        print(f"{r['name']:<28} | {goodput_str:<12} | {retrans_str:<10} | {lat_str:<12} | {dec_str}")

def display_ablation_study():
    print("\n" + "=" * 70)
    print(" PART 2: ABLATION EXPERIMENTS (BURST AWARENESS ON vs OFF)")
    print("=" * 70)
    print("Evaluates whether tracking Gilbert-Elliott burst correlation provides measurable value.")

    ablation = run_ablation_study(seed=42)
    comparisons = ablation["ablation_comparisons"]

    for c in comparisons:
        ch_name = c["channel_type"]
        on_data = c["burst_aware_on"]
        off_data = c["burst_aware_off"]
        reduction = c["retransmission_reduction_ratio"] * 100.0

        print(f"\n--- Channel: {ch_name.upper()} ---")
        print(f"  Configuration             | Goodput    | Retrans %  | Total Retrans | Duration")
        print(f"  AURA-BOLT (Burst-Aware)   | {on_data['goodput_kbps']:>6.1f} Kbps | {on_data['retransmission_ratio']*100:>6.1f}%   | {on_data['total_retransmissions']:>8}      | {on_data['duration_ms']:>6.1f} ms")
        print(f"  AURA-BOLT (Ablated / Off) | {off_data['goodput_kbps']:>6.1f} Kbps | {off_data['retransmission_ratio']*100:>6.1f}%   | {off_data['total_retransmissions']:>8}      | {off_data['duration_ms']:>6.1f} ms")
        print(f"  >> Retransmission Overhead Reduction: {reduction:+.1f}%")

def display_closed_loop_audit_trail():
    print("\n" + "=" * 70)
    print(" PART 3: CLOSED-LOOP PREDICT-APPLY-VERIFY DECISION AUDIT TRAIL")
    print("=" * 70)

    engine = SimulationEngine(
        protocol="aura_bolt",
        data_to_send=SAMPLE_DATA,
        chunk_size=256,
        window_size=4,
        modulus=32,
        one_way_delay_ms=25.0,
        jitter_ms=3.0,
        packet_loss_rate=0.10,
        loss_pattern="burst",
        p_good_to_bad=0.15,
        p_bad_to_bad=0.75,
        initial_rto_ms=180.0,
        enable_burst_awareness=True,
        random_seed=999,
    )
    result = engine.run_all()
    decisions = result["decisions"]

    print(f"Total Decisions Made: {len(decisions)} over {result['metrics']['duration_ms']:.1f} ms\n")
    for d in decisions[:4]:
        print(f"[{d['id']} at t={d['timestamp']}ms] Mode: {d['mode']} | Window: {d['previous_window']} -> {d['selected_window']} | RTO: {d['selected_rto']}ms")
        print(f"  Telemetry Inputs:  SRTT={d['inputs']['srtt']}ms, Loss={int(d['inputs']['recent_loss_rate']*100)}%, Burst State={d['inputs']['channel_state']}, BDP={d['inputs']['bdp_frames']} frames")
        print(f"  Rationale:         {d['reason']}")
        print(f"  Expected Outcome:  {d['expected_outcome']}")
        print(f"  Verification:      Status={d['status']}, Error={d['prediction_error_kbps']} Kbps\n")

if __name__ == "__main__":
    display_four_protocol_comparison()
    display_ablation_study()
    display_closed_loop_audit_trail()
    print("=" * 70)
    print("All empirical benchmarks and ablation tests completed successfully!")
