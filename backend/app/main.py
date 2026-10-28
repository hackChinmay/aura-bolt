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

from app.simulation.engine import SimulationEngine

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
    
    # Generate data payload
    data_payload = (b"AURA-BOLT Protocol Test Chunk Payload " * max(1, req.total_frames))[:req.total_frames * 1024]
    
    engine = SimulationEngine(
        protocol=req.protocol,
        data_to_send=data_payload,
        chunk_size=1024,
        window_size=req.initial_window_size,
        modulus=64,
        one_way_delay_ms=req.one_way_delay_ms,
        jitter_ms=req.jitter_ms,
        packet_loss_rate=req.packet_loss_rate,
        ack_loss_rate=req.ack_loss_rate,
        loss_pattern=req.loss_pattern,
        initial_rto_ms=req.initial_rto_ms,
        random_seed=req.random_seed,
    )

    result = engine.run_all()
    metrics = result["metrics"]

    # Store in SQLite
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO experiments VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            exp_id,
            req.protocol,
            req.total_frames,
            req.packet_loss_rate,
            req.one_way_delay_ms,
            metrics["goodput_kbps"],
            metrics["latency_stats"]["p95_ms"],
            metrics["retransmission_ratio"],
            time.time(),
        )
    )
    conn.commit()
    conn.close()

    return {
        "success": True,
        "experiment_id": exp_id,
        "protocol": req.protocol,
        "is_completed": result["is_completed"],
        "duration_ms": metrics["duration_ms"],
        "total_data_frames_sent": metrics["total_data_frames_sent"],
        "total_retransmissions": metrics["total_retransmissions"],
        "retransmission_ratio": metrics["retransmission_ratio"],
        "packets_lost": metrics["total_packets_lost"],
        "acks_sent": metrics["total_acks_sent"],
        "goodput_kbps": metrics["goodput_kbps"],
        "transmission_throughput_kbps": metrics["transmission_throughput_kbps"],
        "p95_latency_ms": metrics["latency_stats"]["p95_ms"],
        "mean_latency_ms": metrics["latency_stats"]["mean_ms"],
        "integrity_verified": metrics["integrity_verified"],
        "original_sha256": metrics["original_sha256"],
        "reconstructed_sha256": metrics["reconstructed_sha256"],
        "total_events": result["total_events"],
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
