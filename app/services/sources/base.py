"""Shared source-adapter primitives."""
from __future__ import annotations

from dataclasses import dataclass, field


class SourceError(Exception):
    """Raised when a platform cannot provide a usable audio stream."""

    def __init__(self, code: str, message: str, hint: str = "") -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.hint = hint


@dataclass
class ResolvedTrack:
    id: str
    source: str
    name: str
    artist: list[str] = field(default_factory=list)
    album: str = ""
    duration: int = 0
    cover: str = ""
    link: str = ""
    stream_url: str = ""
    ext: str = "mp3"
    bitrate: int = 0
    playable: bool = True
    reason: str = ""
    media_mid: str = ""

    def public(self) -> dict:
        return {
            "id": self.id,
            "source": self.source,
            "name": self.name,
            "artist": self.artist,
            "album": self.album,
            "duration": self.duration,
            "cover": self.cover,
            "link": self.link,
        }


def normalize_duration(value: object) -> int:
    try:
        number = float(value or 0)
    except (TypeError, ValueError):
        return 0
    return int(number)
