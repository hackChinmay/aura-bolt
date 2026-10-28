"""
Deterministic Impairment Channel with Gilbert-Elliott Burst Loss Model (Python)
"""

import math
import random
from typing import Tuple, Optional

class ImpairmentChannel:
    def __init__(
        self,
        seed: int = 42,
        one_way_delay_ms: float = 40.0,
        jitter_ms: float = 6.0,
        packet_loss_rate: float = 0.05,
        ack_loss_rate: float = 0.01,
        loss_pattern: str = "burst",
        p_good_to_bad: float = 0.12,
        p_bad_to_bad: float = 0.70,
    ):
        self.rng = random.Random(seed)
        self.one_way_delay_ms = one_way_delay_ms
        self.jitter_ms = jitter_ms
        self.packet_loss_rate = packet_loss_rate
        self.ack_loss_rate = ack_loss_rate
        self.loss_pattern = loss_pattern
        self.p_good_to_bad = p_good_to_bad
        self.p_bad_to_bad = p_bad_to_bad

        self.channel_state = "GOOD"
        self.consecutive_losses = 0
        self.data_packets_total = 0
        self.data_packets_dropped = 0
        self.acks_total = 0
        self.acks_dropped = 0

    def _advance_markov(self, sim_time_ms: float):
        p_g2b = self.p_good_to_bad
        p_b2b = self.p_bad_to_bad

        if self.loss_pattern == "sudden_degradation":
            if 1200 < sim_time_ms < 3500:
                p_g2b = 0.35
                p_b2b = 0.85
        elif self.loss_pattern == "recovery":
            if sim_time_ms < 1800:
                p_g2b = 0.40
                p_b2b = 0.80
            else:
                p_g2b = 0.02
                p_b2b = 0.20

        if self.channel_state == "GOOD":
            if self.rng.random() < p_g2b:
                self.channel_state = "BAD"
        else:
            if self.rng.random() >= p_b2b:
                self.channel_state = "GOOD"

    def should_drop_data(self, sim_time_ms: float) -> Tuple[bool, Optional[str]]:
        self.data_packets_total += 1
        self._advance_markov(sim_time_ms)

        if self.loss_pattern == "random":
            drop = self.rng.random() < self.packet_loss_rate
            if drop:
                self.data_packets_dropped += 1
                self.consecutive_losses += 1
                return True, "Bernoulli independent loss"
            self.consecutive_losses = 0
            return False, None

        # Gilbert-Elliott burst model: BAD state loss prob = 0.85; GOOD state background loss = 0.02
        drop_prob = 0.85 if self.channel_state == "BAD" else (self.packet_loss_rate * 0.2)
        drop = self.rng.random() < drop_prob
        if drop:
            self.data_packets_dropped += 1
            self.consecutive_losses += 1
            return True, f"Gilbert-Elliott Burst ({self.channel_state} state)"
        
        self.consecutive_losses = 0
        return False, None

    def should_drop_ack(self) -> Tuple[bool, Optional[str]]:
        self.acks_total += 1
        drop = self.rng.random() < self.ack_loss_rate
        if drop:
            self.acks_dropped += 1
            return True, "Reverse channel ACK loss"
        return False, None

    def calculate_transit_delay_ms(self) -> float:
        jitter = self.rng.gauss(0, self.jitter_ms / 2) if self.jitter_ms > 0 else 0
        delay = max(2.0, self.one_way_delay_ms + jitter)
        return round(delay, 2)
