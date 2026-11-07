"""Shared Pydantic models for the HTTP API."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

SourceId = Literal["netease", "qq", "upload"]
RecipeId = Literal["quick", "karaoke", "acapella"]


class Track(BaseModel):
    id: str
    source: SourceId
    name: str
    artist: list[str] = Field(default_factory=list)
    album: str = ""
    duration: int = 0
    cover: str = ""
    link: str = ""

    @property
    def artist_text(self) -> str:
        return " / ".join(a for a in self.artist if a)


class SearchResponse(BaseModel):
    source: str
    query: str
    items: list[Track]


class ResolveRequest(BaseModel):
    source: SourceId
    input: str


class ResolveResponse(BaseModel):
    track: Track
    playable: bool
    reason: str = ""


class UploadResponse(BaseModel):
    uploadId: str
    filename: str
    size: int
    duration: int = 0


class CreateJobRequest(BaseModel):
    recipe: RecipeId = "karaoke"
    format: Literal["mp3", "wav"] = "mp3"
    track: Track | None = None
    uploadId: str | None = None
    # 显式音轨多选（v1.2）；为空时回退到 recipe 预设
    stems: list[str] | None = None


class Stem(BaseModel):
    id: str
    label: str
    description: str
    filename: str
    size: int = 0
    duration: int = 0
    url: str
    download_url: str


class JobError(BaseModel):
    code: str
    message: str
    hint: str = ""


class JobView(BaseModel):
    id: str
    state: str
    stage: str
    stage_label: str
    progress: int
    message: str
    created_at: int
    elapsed: int
    queue_position: int = 0
    track: Track
    recipe: RecipeId
    format: str
    stem_roles: list[str] = Field(default_factory=list)
    stems: list[Stem] = Field(default_factory=list)
    zip_url: str = ""
    error: JobError | None = None
    events: list[str] = Field(default_factory=list)


class RecipeInfo(BaseModel):
    id: RecipeId
    name: str
    tagline: str
    stems: list[str]
    model_runs: int
    eta_seconds: int
    recommended: bool = False


class HealthResponse(BaseModel):
    ok: bool
    app: str
    python: str
    ffmpeg: bool
    ffmpeg_path: str
    audio_separator: bool
    audio_separator_version: str
    models: dict[str, bool]
    device: str
    queue: int
    running: int
    jobs_total: int
    hints: list[str] = Field(default_factory=list)
