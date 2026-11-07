"""Tiny in-memory fixed-window rate limiter."""
from __future__ import annotations

import time
from collections import defaultdict


class RateLimiter:
    def __init__(self, per_minute: int) -> None:
        self.per_minute = max(1, per_minute)
        self.window = 60
        self._hits: dict[str, list[float]] = defaultdict(list)

    def allow(self, key: str) -> bool:
        now = time.time()
        cutoff = now - self.window
        hits = [item for item in self._hits[key] if item >= cutoff]
        if len(hits) >= self.per_minute:
            self._hits[key] = hits
            return False
        hits.append(now)
        self._hits[key] = hits
        return True
