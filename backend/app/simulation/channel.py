"""
Deterministic Impairment Channel with Gilbert-Elliott Burst Loss and Jitter.
Reproducible under pseudo-random seed.
"""

import math
import random
from typing import Tuple, Optional
from app.protocols.frame import Frame, FrameType, FrameStatus

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
        corrupt_rate: float = 0.0,
    ):
        self.seed = seed
        self.rng = random.Random(seed)
        self.one_way_delay_ms = max(1.0, one_way_delay_ms)
        self.jitter_ms = max(0.0, jitter_ms)
        self.packet_loss_rate = max(0.0, min(1.0, packet_loss_rate))
        self.ack_loss_rate = max(0.0, min(1.0, ack_loss_rate))
        self.loss_pattern = loss_pattern
        self.p_good_to_bad = p_good_to_bad
        self.p_bad_to_bad = p_bad_to_bad
        self.corrupt_rate = corrupt_rate

        self.channel_state: str = "GOOD"
        self.consecutive_losses: int = 0
        self.data_packets_total: int = 0
        self.data_packets_dropped: int = 0
        self.acks_total: int = 0
        self.acks_dropped: int = 0

    def reset(self, new_seed: Optional[int] = None):
        if new_seed is not None:
            self.seed = new_seed
        self.rng = random.Random(self.seed)
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
            if 1000.0 <= sim_time_ms <= 3000.0:
                p_g2b = 0.40
                p_b2b = 0.85
        elif self.loss_pattern == "recovery":
            if sim_time_ms < 1500.0:
                p_g2b = 0.35
                p_b2b = 0.80
            else:
                p_g2b = 0.01
                p_b2b = 0.15

        if self.channel_state == "GOOD":
            if self.rng.random() < p_g2b:
                self.channel_state = "BAD"
        else:
            if self.rng.random() >= p_b2b:
                self.channel_state = "GOOD"

    def process_data_frame(self, frame: Frame, sim_time_ms: float) -> Tuple[bool, float, Optional[str]]:
        """
        Evaluate channel impairment on forward data frame.
        Returns: (is_dropped, transit_delay_ms, drop_reason)
        """
        self.data_packets_total += 1
        transit_delay = self.calculate_transit_delay_ms()

        if self.packet_loss_rate <= 0.0:
            return False, transit_delay, None

        self._advance_markov(sim_time_ms)

        # Check corruption
        if self.corrupt_rate > 0.0 and self.rng.random() < self.corrupt_rate:
            frame.is_corrupted = True
            frame.checksum ^= 0xFFFF  # Invalidate checksum

        if self.loss_pattern == "random":
            if self.rng.random() < self.packet_loss_rate:
                self.data_packets_dropped += 1
                self.consecutive_losses += 1
                return True, transit_delay, "Bernoulli independent loss"
            self.consecutive_losses = 0
            return False, transit_delay, None

        if self.loss_pattern == "alternating":
            if (self.data_packets_total % 3) == 0:
                self.data_packets_dropped += 1
                return True, transit_delay, "Alternating channel fade"
            return False, transit_delay, None

        # Gilbert-Elliott model:
        # In BAD state, loss probability is high (~85%); in GOOD state, background loss is minimal
        drop_prob = 0.85 if self.channel_state == "BAD" else (self.packet_loss_rate * 0.20)
        if self.rng.random() < drop_prob:
            self.data_packets_dropped += 1
            self.consecutive_losses += 1
            reason = f"Gilbert-Elliott Burst ({self.channel_state} state, run={self.consecutive_losses})"
            return True, transit_delay, reason

        self.consecutive_losses = 0
        return False, transit_delay, None

    def process_ack_frame(self, _ack: Frame, _sim_time_ms: float) -> Tuple[bool, float, Optional[str]]:
        """
        Evaluate channel impairment on reverse ACK frame.
        Returns: (is_dropped, transit_delay_ms, drop_reason)
        """
        self.acks_total += 1
        transit_delay = self.calculate_transit_delay_ms()

        if self.ack_loss_rate <= 0.0:
            return False, transit_delay, None

        if self.rng.random() < self.ack_loss_rate:
            self.acks_dropped += 1
            return True, transit_delay, "Reverse channel ACK loss"

        return False, transit_delay, None

    def calculate_transit_delay_ms(self) -> float:
        """One-way propagation delay with Gaussian jitter (lower-bounded at 1ms)."""
        jitter = self.rng.gauss(0.0, self.jitter_ms / 2.0) if self.jitter_ms > 0 else 0.0
        return max(1.0, round(self.one_way_delay_ms + jitter, 2))
