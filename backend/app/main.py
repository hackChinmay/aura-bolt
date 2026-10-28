"""
AURA-BOLT FastAPI Main Application
Provides endpoints for experiments, simulation execution, telemetry, and CSV export.
"""

import time
import sqlite3
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.protocols.stop_and_wait import StopAndWaitSender, StopAndWaitReceiver
from app.protocols.go_back_n import GoBackNSender, GoBackNReceiver
from app.protocols.selective_repeat import SelectiveRepeatSender, SelectiveRepeatReceiver
from app.simulation.channel import ImpairmentChannel
from app.adaptive.burst_detector import BurstDetectorAndRttEstimator
from app.adaptive.controller import AuraBoltController

app = FastAPI(
    title="AURA-BOLT Protocol Framework",
    description="Burst-Aware Adaptive ARQ and Sliding Window Optimization Platform",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SQLite database
DB_PATH = "aura_bolt_experiments.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS experiments (
        id TEXT PRIMARY KEY,
        protocol TEXT,
        total_frames INTEGER,
        loss_rate REAL,
        delay_ms REAL,
        goodput_kbps REAL,
        latency_p95_ms REAL,
        retrans_ratio REAL,
        created_at REAL
    )
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS controller_decisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        experiment_id TEXT,
        timestamp REAL,
        mode TEXT,
        previous_window INTEGER,
        selected_window INTEGER,
        reason TEXT
    )
    """)
    conn.commit()
    conn.close()

init_db()

class ExperimentRequest(BaseModel):
    id: Optional[str] = None
    protocol: str = "aura_bolt"
    total_frames: int = 60
    one_way_delay_ms: float = 40.0
    jitter_ms: float = 6.0
    packet_loss_rate: float = 0.05
    ack_loss_rate: float = 0.01
    loss_pattern: str = "burst"
    initial_window_size: int = 8
    max_window_size: int = 24
    receiver_buffer_size: int = 24
    initial_rto_ms: float = 300.0
    random_seed: int = 42
    enable_burst_awareness: bool = True

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "AURA-BOLT Research Backend",
        "timestamp": time.time(),
        "database": "SQLite initialized",
    }

@app.post("/api/experiments/run")
def run_simulation(req: ExperimentRequest):
    exp_id = req.id or f"py-exp-{int(time.time()*1000)}"
    channel = ImpairmentChannel(
        seed=req.random_seed,
        one_way_delay_ms=req.one_way_delay_ms,
        jitter_ms=req.jitter_ms,
        packet_loss_rate=req.packet_loss_rate,
        ack_loss_rate=req.ack_loss_rate,
        loss_pattern=req.loss_pattern,
    )

    burst_detector = BurstDetectorAndRttEstimator(
        initial_rtt_ms=req.one_way_delay_ms * 2,
        initial_rto_ms=req.initial_rto_ms,
    )

    controller = AuraBoltController(
        receiver_buffer_size=req.receiver_buffer_size,
        enable_burst_awareness=req.enable_burst_awareness,
    )

    # Initialize requested protocol
    if req.protocol == "stop_and_wait":
        sender = StopAndWaitSender(req.total_frames, req.initial_rto_ms)
        receiver = StopAndWaitReceiver(req.total_frames)
    elif req.protocol == "go_back_n":
        sender = GoBackNSender(req.total_frames, req.initial_window_size, 64, req.initial_rto_ms)
        receiver = GoBackNReceiver(req.total_frames, 64)
    else:
        # Selective Repeat or AURA-BOLT
        sender = SelectiveRepeatSender(req.total_frames, req.initial_window_size, 64, req.initial_rto_ms)
        receiver = SelectiveRepeatReceiver(req.total_frames, req.initial_window_size, 64)

    sim_time = 0.0
    frames_sent = 0
    retransmissions = 0
    acks_sent = 0
    packets_lost = 0
    latencies = []
    delivered_bytes = 0

    # Event loop (simplified for synchronous evaluation)
    while not receiver.is_transfer_complete() and sim_time < 30000:
        sim_time += 15.0  # Time step

        # Sender pumps frame
        if sender.can_send():
            f = sender.on_send(sim_time)
            if f:
                frames_sent += 1
                if f.get("is_retransmission"):
                    retransmissions += 1

                drop, reason = channel.should_drop_data(sim_time)
                if drop:
                    packets_lost += 1
                    burst_detector.record_outcome(False)
                else:
                    burst_detector.record_outcome(True)
                    delivered, ack, _ = receiver.on_frame_arrival(f, sim_time)
                    if delivered:
                        delivered_bytes += 1024
                        latencies.append(channel.calculate_transit_delay_ms() * 2)

                    # Return ACK
                    ack_drop, _ = channel.should_drop_ack()
                    if not ack_drop:
                        acks_sent += 1
                        if req.protocol == "stop_and_wait":
                            sender.on_ack_received(ack["ack_number"], sim_time)
                        elif req.protocol == "go_back_n":
                            sender.on_cumulative_ack(ack["ack_number"], sim_time)
                        else:
                            sender.on_individual_ack(ack["ack_number"], sim_time)

        # Check timeouts
        if req.protocol == "stop_and_wait":
            if sender.check_timeout(sim_time):
                burst_detector.on_timeout_backoff()
        elif req.protocol == "go_back_n":
            if sender.check_timeout(sim_time):
                burst_detector.on_timeout_backoff()
        else:
            if sender.check_timeouts(sim_time) > 0:
                burst_detector.on_timeout_backoff()

        # Controller evaluate
        if req.protocol == "aura_bolt" and int(sim_time) % 250 == 0:
            stats = burst_detector.get_stats()
            measured_goodput = (delivered_bytes * 8) / (max(0.1, sim_time / 1000.0) * 1000.0)
            dec = controller.evaluate(
                sim_time,
                sender.window_size,
                sender.current_rto_ms,
                stats,
                measured_goodput,
            )
            sender.window_size = dec["selected_window"]
            sender.current_rto_ms = dec["selected_rto"]

    duration_sec = max(0.001, sim_time / 1000.0)
    goodput_kbps = round((delivered_bytes * 8) / (duration_sec * 1000.0), 1)
    retrans_ratio = round(retransmissions / frames_sent, 3) if frames_sent > 0 else 0.0
    latencies.sort()
    p95_lat = latencies[int(len(latencies) * 0.95)] if latencies else 0.0

    # Store in SQLite
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO experiments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (exp_id, req.protocol, req.total_frames, req.packet_loss_rate, req.one_way_delay_ms, goodput_kbps, p95_lat, retrans_ratio, time.time())
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "experiment_id": exp_id,
        "protocol": req.protocol,
        "duration_ms": round(sim_time, 1),
        "total_frames_sent": frames_sent,
        "total_retransmissions": retransmissions,
        "retransmission_ratio": retrans_ratio,
        "packets_lost": packets_lost,
        "acks_sent": acks_sent,
        "goodput_kbps": goodput_kbps,
        "p95_latency_ms": round(p95_lat, 1),
        "decisions_count": len(controller.decision_history),
    }

@app.get("/api/experiments")
def list_experiments():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT * FROM experiments ORDER BY created_at DESC LIMIT 50")
    rows = cur.fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "protocol": r[1],
            "total_frames": r[2],
            "loss_rate": r[3],
            "delay_ms": r[4],
            "goodput_kbps": r[5],
            "p95_latency_ms": r[6],
            "retrans_ratio": r[7],
            "created_at": r[8],
        }
        for r in rows
    ]
