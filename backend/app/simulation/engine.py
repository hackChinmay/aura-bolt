"""
Deterministic Event-Driven Network Simulation Engine.
Drives sender, receiver, and impairment channel across discrete simulation time.
Integrates AURA-BOLT Adaptive Controller and baseline controllers on top of tested ARQ engines.
"""

from typing import List, Dict, Any, Optional, Union
import hashlib
from app.protocols.frame import Frame, FrameType, FrameStatus
from app.protocols.stop_and_wait import StopAndWaitSender, StopAndWaitReceiver
from app.protocols.go_back_n import GoBackNSender, GoBackNReceiver
from app.protocols.selective_repeat import SelectiveRepeatSender, SelectiveRepeatReceiver
from app.simulation.channel import ImpairmentChannel
from app.simulation.event_scheduler import EventScheduler, EventType, Event
from app.metrics.calculations import calculate_metrics
from app.adaptive.burst_detector import BurstDetectorAndRttEstimator
from app.adaptive.controller import AuraBoltAdaptiveController
from app.adaptive.baselines import LossRateAdaptiveController

class SimulationEngine:
    def __init__(
        self,
        protocol: str,
        data_to_send: bytes,
        chunk_size: int = 1024,
        window_size: int = 4,
        modulus: int = 16,
        one_way_delay_ms: float = 40.0,
        jitter_ms: float = 6.0,
        packet_loss_rate: float = 0.05,
        ack_loss_rate: float = 0.01,
        loss_pattern: str = "burst",
        p_good_to_bad: float = 0.12,
        p_bad_to_bad: float = 0.70,
        initial_rto_ms: float = 300.0,
        receiver_buffer_size: int = 24,
        max_window_size: int = 32,
        alpha: float = 0.40,
        beta: float = 0.25,
        gamma: float = 0.20,
        delta: float = 0.15,
        enable_burst_awareness: bool = True,
        decision_interval_ms: float = 150.0,
        random_seed: int = 42,
    ):
        self.protocol = protocol.lower()
        self.original_data = data_to_send
        self.original_sha256 = hashlib.sha256(data_to_send).hexdigest()
        self.chunk_size = chunk_size

        # Chunk the data
        self.chunks: List[bytes] = []
        for i in range(0, len(data_to_send), chunk_size):
            self.chunks.append(data_to_send[i : i + chunk_size])
        if not self.chunks:
            self.chunks.append(b"")

        self.total_chunks = len(self.chunks)
        self.random_seed = random_seed
        self.initial_rto_ms = initial_rto_ms
        self.receiver_buffer_size = receiver_buffer_size
        self.max_window_size = max_window_size
        self.enable_burst_awareness = enable_burst_awareness

        # Impairment channel & event scheduler
        self.channel = ImpairmentChannel(
            seed=random_seed,
            one_way_delay_ms=one_way_delay_ms,
            jitter_ms=jitter_ms,
            packet_loss_rate=packet_loss_rate,
            ack_loss_rate=ack_loss_rate,
            loss_pattern=loss_pattern,
            p_good_to_bad=p_good_to_bad,
            p_bad_to_bad=p_bad_to_bad,
        )
        self.scheduler = EventScheduler()

        # Telemetry & history
        self.events_history: List[Dict[str, Any]] = []
        self.delivery_latencies: List[float] = []
        self.total_data_frames_sent: int = 0
        self.total_retransmissions: int = 0
        self.total_acks_sent: int = 0
        self.total_packets_lost: int = 0
        self.total_acks_lost: int = 0
        self.total_bytes_delivered: int = 0

        self.is_completed: bool = False
        self.start_time_ms: float = 0.0
        self.end_time_ms: float = 0.0

        # Protocol instances
        self.sender: Union[StopAndWaitSender, GoBackNSender, SelectiveRepeatSender]
        self.receiver: Union[StopAndWaitReceiver, GoBackNReceiver, SelectiveRepeatReceiver]

        if self.protocol == "stop_and_wait":
            self.sender = StopAndWaitSender(self.chunks, initial_rto_ms=initial_rto_ms)
            self.receiver = StopAndWaitReceiver(self.total_chunks)
        elif self.protocol == "go_back_n":
            self.sender = GoBackNSender(self.chunks, window_size=window_size, modulus=modulus, initial_rto_ms=initial_rto_ms)
            self.receiver = GoBackNReceiver(self.total_chunks, modulus=modulus)
        elif self.protocol in ("selective_repeat", "aura_bolt", "loss_rate_adaptive"):
            self.sender = SelectiveRepeatSender(self.chunks, window_size=window_size, modulus=modulus, initial_rto_ms=initial_rto_ms)
            self.receiver = SelectiveRepeatReceiver(self.total_chunks, window_size=receiver_buffer_size, modulus=modulus)
        else:
            raise ValueError(f"Unknown protocol: {protocol}")

        # Adaptive components
        self.burst_detector = BurstDetectorAndRttEstimator(
            initial_rtt_ms=one_way_delay_ms * 2.0,
            initial_rto_ms=initial_rto_ms,
        )
        self.controller: Optional[Union[AuraBoltAdaptiveController, LossRateAdaptiveController]] = None

        if self.protocol == "aura_bolt":
            self.controller = AuraBoltAdaptiveController(
                alpha=alpha,
                beta=beta,
                gamma=gamma,
                delta=delta,
                receiver_buffer_size=receiver_buffer_size,
                seq_number_modulus=modulus,
                max_window_size=max_window_size,
                enable_burst_awareness=enable_burst_awareness,
                decision_interval_ms=decision_interval_ms,
            )
            # Schedule periodic evaluation
            self.scheduler.schedule(decision_interval_ms, EventType.METRIC_SAMPLE)
        elif self.protocol == "loss_rate_adaptive":
            self.controller = LossRateAdaptiveController(
                min_window=1,
                max_window=min(receiver_buffer_size, modulus // 2),
                decision_interval_ms=decision_interval_ms,
            )
            self.scheduler.schedule(decision_interval_ms, EventType.METRIC_SAMPLE)

        # Schedule initial pump and periodic timer check
        self.scheduler.schedule(0.0, EventType.TIMEOUT_CHECK)
        self.pump_sender()

    def get_sim_time(self) -> float:
        return self.scheduler.current_time_ms

    def pump_sender(self):
        """Attempts to transmit available frames from sender window."""
        sim_time = self.get_sim_time()
        while self.sender.can_send():
            frame = self.sender.on_send(sim_time)
            if not frame:
                break

            self.total_data_frames_sent += 1
            if frame.is_retransmission:
                self.total_retransmissions += 1

            # Process forward channel impairment
            is_dropped, transit_delay, drop_reason = self.channel.process_data_frame(frame, sim_time)

            if is_dropped:
                self.total_packets_lost += 1
                frame.status = FrameStatus.LOST
                frame.loss_reason = drop_reason
                self.burst_detector.record_transmission_outcome(False)
                self.events_history.append(frame.to_dict())
            else:
                # Schedule frame arrival at receiver
                self.scheduler.schedule(transit_delay, EventType.DATA_ARRIVAL, data=frame)

    def _handle_data_arrival(self, frame: Frame):
        sim_time = self.get_sim_time()
        frame.arrived_at = sim_time
        frame.status = FrameStatus.DELIVERED

        ack_frame: Optional[Frame] = None
        accepted = False

        if isinstance(self.receiver, StopAndWaitReceiver):
            accepted, ack_frame, _ = self.receiver.on_frame_arrival(frame, sim_time)
            if accepted:
                self.total_bytes_delivered += frame.payload_length
                self.delivery_latencies.append(sim_time - frame.sent_at)
        elif isinstance(self.receiver, GoBackNReceiver):
            accepted, ack_frame, _ = self.receiver.on_frame_arrival(frame, sim_time)
            if accepted:
                self.total_bytes_delivered += frame.payload_length
                self.delivery_latencies.append(sim_time - frame.sent_at)
        elif isinstance(self.receiver, SelectiveRepeatReceiver):
            accepted, ack_frame, delivered_now_count = self.receiver.on_frame_arrival(frame, sim_time)
            if delivered_now_count > 0:
                self.total_bytes_delivered += frame.payload_length * delivered_now_count
                self.delivery_latencies.append(sim_time - frame.sent_at)

        self.events_history.append(frame.to_dict())

        # If an ACK was generated, send it back through reverse channel
        if ack_frame:
            self.total_acks_sent += 1
            is_ack_dropped, ack_delay, ack_drop_reason = self.channel.process_ack_frame(ack_frame, sim_time)

            if is_ack_dropped:
                self.total_acks_lost += 1
                ack_frame.status = FrameStatus.ACK_LOST
                ack_frame.loss_reason = ack_drop_reason
                self.events_history.append(ack_frame.to_dict())
            else:
                # Schedule ACK arrival at sender
                self.scheduler.schedule(ack_delay, EventType.ACK_ARRIVAL, data=ack_frame)

    def _handle_ack_arrival(self, ack_frame: Frame):
        sim_time = self.get_sim_time()
        ack_frame.arrived_at = sim_time
        ack_frame.status = FrameStatus.ACKED

        # Record Karn's RTT sample
        rtt_sample = max(1.0, sim_time - ack_frame.sent_at)
        self.burst_detector.record_rtt_sample(rtt_sample, is_retransmission=ack_frame.is_retransmission)
        self.burst_detector.record_transmission_outcome(True)
        self.burst_detector.record_delivered_payload(self.chunk_size, sim_time)

        if isinstance(self.sender, StopAndWaitSender):
            self.sender.on_ack_received(ack_frame, sim_time)
        elif isinstance(self.sender, GoBackNSender):
            self.sender.on_cumulative_ack(ack_frame, sim_time)
        elif isinstance(self.sender, SelectiveRepeatSender):
            self.sender.on_individual_ack(ack_frame, sim_time)

        self.events_history.append(ack_frame.to_dict())
        self.pump_sender()

    def _handle_timeout_check(self):
        sim_time = self.get_sim_time()
        retransmitted = False

        if isinstance(self.sender, StopAndWaitSender):
            retransmitted = self.sender.check_timeout(sim_time)
        elif isinstance(self.sender, GoBackNSender):
            retransmitted = self.sender.check_timeout(sim_time)
        elif isinstance(self.sender, SelectiveRepeatSender):
            retransmitted = (self.sender.check_timeouts(sim_time) > 0)

        if retransmitted:
            self.burst_detector.on_timeout_backoff()
            self.pump_sender()

        # Check if complete
        if self.receiver.is_transfer_complete():
            self.is_completed = True
            self.end_time_ms = sim_time
            return

        # Reschedule next check in 25ms virtual simulation time
        self.scheduler.schedule(25.0, EventType.TIMEOUT_CHECK)

    def _handle_adaptive_evaluation(self):
        """Periodically evaluates adaptive controller and updates window & RTO."""
        sim_time = self.get_sim_time()
        if self.controller and isinstance(self.sender, SelectiveRepeatSender):
            stats = self.burst_detector.get_burst_statistics(self.chunk_size)
            elapsed_sec = max(0.001, sim_time / 1000.0)
            measured_goodput_kbps = (self.total_bytes_delivered * 8.0) / (elapsed_sec * 1000.0)

            eval_res = self.controller.evaluate(
                sim_time_ms=sim_time,
                current_window=self.sender.window_size,
                current_rto=self.sender.current_rto_ms,
                stats=stats,
                measured_goodput_kbps=measured_goodput_kbps,
            )

            if eval_res.get("decision_made"):
                new_w = eval_res["new_window"]
                new_rto = eval_res["new_rto"]
                self.sender.set_window_size(new_w)
                self.sender.current_rto_ms = new_rto
                if isinstance(self.receiver, SelectiveRepeatReceiver):
                    self.receiver.window_size = min(self.receiver_buffer_size, self.sender.modulus // 2)
                self.pump_sender()

        if not self.is_completed:
            self.scheduler.schedule(150.0, EventType.METRIC_SAMPLE)

    def step(self) -> Optional[Event]:
        """Process next discrete event from priority queue."""
        if self.is_completed or not self.scheduler.has_events():
            return None

        event = self.scheduler.pop_next()
        if not event:
            return None

        if event.event_type == EventType.DATA_ARRIVAL:
            self._handle_data_arrival(event.data)
        elif event.event_type == EventType.ACK_ARRIVAL:
            self._handle_ack_arrival(event.data)
        elif event.event_type == EventType.TIMEOUT_CHECK:
            self._handle_timeout_check()
        elif event.event_type == EventType.METRIC_SAMPLE:
            self._handle_adaptive_evaluation()

        self.pump_sender()

        if self.receiver.is_transfer_complete() and not self.is_completed:
            self.is_completed = True
            self.end_time_ms = self.get_sim_time()

        return event

    def run_all(self, max_sim_time_ms: float = 60000.0) -> Dict[str, Any]:
        """Executes simulation to completion or until max_sim_time_ms."""
        safety_loop = 0
        while not self.is_completed and self.scheduler.has_events() and safety_loop < 100000:
            safety_loop += 1
            if self.get_sim_time() > max_sim_time_ms:
                break
            self.step()

        if not self.is_completed and self.receiver.is_transfer_complete():
            self.is_completed = True
            self.end_time_ms = self.get_sim_time()

        reconstructed_data = self.receiver.get_reconstructed_data()
        reconstructed_sha256 = hashlib.sha256(reconstructed_data).hexdigest()

        metrics = calculate_metrics(
            total_payload_bytes_delivered=self.total_bytes_delivered,
            total_data_frames_sent=self.total_data_frames_sent,
            total_retransmissions=self.total_retransmissions,
            total_acks_sent=self.total_acks_sent,
            total_packets_lost=self.total_packets_lost,
            total_acks_lost=self.total_acks_lost,
            start_time_ms=self.start_time_ms,
            end_time_ms=self.end_time_ms or self.get_sim_time(),
            delivery_latencies_ms=self.delivery_latencies,
            original_sha256=self.original_sha256,
            reconstructed_sha256=reconstructed_sha256,
        )

        audit_trail = []
        if self.controller:
            audit_trail = self.controller.get_audit_trail() if hasattr(self.controller, "get_audit_trail") else self.controller.decision_history

        burst_stats = self.burst_detector.get_burst_statistics(self.chunk_size)

        return {
            "protocol": self.protocol,
            "is_completed": self.is_completed,
            "metrics": metrics,
            "burst_statistics": burst_stats,
            "decisions": audit_trail,
            "decisions_count": len(audit_trail),
            "total_events": len(self.events_history),
            "reconstructed_bytes_len": len(reconstructed_data),
        }
