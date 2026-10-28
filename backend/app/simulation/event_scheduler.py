"""
Priority Queue Discrete-Event Scheduler for Network Simulation.
Maintains virtual simulation time with microsecond float precision.
Strictly decoupled from real wall-clock time.
"""

import heapq
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

class EventType(str, Enum):
    DATA_DEPARTURE = "DATA_DEPARTURE"
    DATA_ARRIVAL = "DATA_ARRIVAL"
    ACK_DEPARTURE = "ACK_DEPARTURE"
    ACK_ARRIVAL = "ACK_ARRIVAL"
    TIMEOUT_CHECK = "TIMEOUT_CHECK"
    METRIC_SAMPLE = "METRIC_SAMPLE"

class Event:
    __slots__ = ("event_id", "time_ms", "event_type", "order", "data", "cancelled")

    def __init__(self, event_id: str, time_ms: float, event_type: EventType, order: int, data: Any = None):
        self.event_id = event_id
        self.time_ms = time_ms
        self.event_type = event_type
        self.order = order
        self.data = data
        self.cancelled = False

    def __lt__(self, other: "Event") -> bool:
        if self.time_ms != other.time_ms:
            return self.time_ms < other.time_ms
        return self.order < other.order

    def __repr__(self) -> str:
        return f"<Event {self.event_id} at {self.time_ms:.2f}ms type={self.event_type.value}>"

class EventScheduler:
    def __init__(self):
        self.current_time_ms: float = 0.0
        self._queue: List[Event] = []
        self._counter: int = 0
        self._active_events: Dict[str, Event] = {}

    def schedule(self, delay_ms: float, event_type: EventType, data: Any = None, event_id: Optional[str] = None) -> Event:
        """Schedule an event at current_time_ms + delay_ms."""
        self._counter += 1
        target_time = max(self.current_time_ms, self.current_time_ms + max(0.0, delay_ms))
        if event_id is None:
            event_id = f"ev-{self._counter}"
        
        event = Event(
            event_id=event_id,
            time_ms=target_time,
            event_type=event_type,
            order=self._counter,
            data=data,
        )
        self._active_events[event_id] = event
        heapq.heappush(self._queue, event)
        return event

    def cancel(self, event_id: str) -> bool:
        """Cancel an event by ID so it will be discarded when popped."""
        event = self._active_events.pop(event_id, None)
        if event:
            event.cancelled = True
            return True
        return False

    def pop_next(self) -> Optional[Event]:
        """Advance simulation clock to next event time and return event."""
        while self._queue:
            event = heapq.heappop(self._queue)
            if event.cancelled:
                continue
            self._active_events.pop(event.event_id, None)
            self.current_time_ms = event.time_ms
            return event
        return None

    def peek_next_time(self) -> Optional[float]:
        while self._queue and self._queue[0].cancelled:
            heapq.heappop(self._queue)
        if self._queue:
            return self._queue[0].time_ms
        return None

    def has_events(self) -> bool:
        while self._queue and self._queue[0].cancelled:
            heapq.heappop(self._queue)
        return len(self._queue) > 0

    def reset(self):
        self.current_time_ms = 0.0
        self._queue.clear()
        self._counter = 0
        self._active_events.clear()
