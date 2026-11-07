"""Filesystem layout, filename hygiene and retention helpers."""
from __future__ import annotations

import json
import re
import shutil
import time
from pathlib import Path
from typing import Any

from app.config import settings

JOB_ID_RE = re.compile(r"^[0-9a-f]{32}$")
_ILLEGAL = re.compile(r'[\\/:*?"<>|\r\n\t]+')
_SPACES = re.compile(r"\s+")


def valid_job_id(job_id: str) -> bool:
    return bool(JOB_ID_RE.fullmatch(job_id or ""))


def job_dir(job_id: str) -> Path:
    if not valid_job_id(job_id):
        raise ValueError("invalid job id")
    return settings.jobs_dir / job_id


def upload_path(upload_id: str) -> Path | None:
    if not valid_job_id(upload_id):
        return None
    matches = sorted(settings.uploads_dir.glob(f"{upload_id}.*"))
    return matches[0] if matches else None


def ensure_job_dir(job_id: str) -> Path:
    path = job_dir(job_id)
    path.mkdir(parents=True, exist_ok=True)
    (path / "stems").mkdir(exist_ok=True)
    (path / "out").mkdir(exist_ok=True)
    return path


def sanitize(text: str, fallback: str = "track") -> str:
    cleaned = _ILLEGAL.sub("_", (text or "").strip())
    cleaned = _SPACES.sub(" ", cleaned).strip(" ._")
    return cleaned[:80] or fallback


def stem_filename(artist: str, title: str, label: str, ext: str) -> str:
    base = f"{sanitize(artist, '未知歌手')}-{sanitize(title, '未命名')}-{sanitize(label, 'stem')}"
    return f"{base}.{ext.lstrip('.')}"


def manifest_path(job_id: str) -> Path:
    return job_dir(job_id) / "job.json"


def write_manifest(job_id: str, payload: dict[str, Any]) -> None:
    path = manifest_path(job_id)
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def read_manifest(job_id: str) -> dict[str, Any] | None:
    path = manifest_path(job_id)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def remove_job_dir(job_id: str) -> None:
    path = settings.jobs_dir / job_id
    if path.exists() and valid_job_id(job_id):
        shutil.rmtree(path, ignore_errors=True)


def cleanup_expired(ttl_hours: int) -> list[str]:
    """Delete job/upload folders older than the retention window."""
    cutoff = time.time() - ttl_hours * 3600
    removed: list[str] = []
    for path in list(settings.jobs_dir.glob("*")):
        try:
            if path.is_dir() and path.stat().st_mtime < cutoff:
                shutil.rmtree(path, ignore_errors=True)
                removed.append(path.name)
        except OSError:
            continue
    for path in list(settings.uploads_dir.glob("*")):
        try:
            if path.is_file() and path.stat().st_mtime < cutoff:
                path.unlink(missing_ok=True)
                removed.append(path.name)
        except OSError:
            continue
    return removed


def dir_size(path: Path) -> int:
    total = 0
    for item in path.rglob("*"):
        if item.is_file():
            try:
                total += item.stat().st_size
            except OSError:
                pass
    return total
