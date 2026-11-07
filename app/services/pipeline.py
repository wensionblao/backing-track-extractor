"""Job pipeline: resolve → download → separate → package."""
from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import time
import zipfile
from pathlib import Path

from app.config import BASE_DIR, settings
from app.services.downloader import download
from app.services.jobs import Job, store
from app.services.sources import registry
from app.services.sources.base import SourceError
from app.services.storage import ensure_job_dir, job_dir, upload_path
from app.worker.audio import ensure_ffmpeg, probe_duration

STEM_ORDER = [
    "instrumental_clean",
    "instrumental_harmony",
    "vocal_lead",
    "vocal_harmony",
    "vocal_all",
]


def _fail(job: Job, code: str, message: str, hint: str = "") -> None:
    store.update(
        job,
        state="failed",
        stage="failed",
        progress=100,
        message=message,
        finished_at=time.time(),
        error={"code": code, "message": message, "hint": hint},
    )
    store.add_event(job, message)


def _zip_outputs(job: Job) -> Path:
    out_dir = job_dir(job.id) / "out"
    zip_path = job_dir(job.id) / "stems.zip"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in sorted(out_dir.iterdir()):
            if item.is_file():
                archive.write(item, arcname=item.name)
    return zip_path


def _stage_state(stage: str) -> str:
    if stage in {"prepare", "load_model"}:
        return "preparing"
    if stage in {"separate", "separate_inst"}:
        return "separating_inst"
    if stage == "separate_kara":
        return "separating_kara"
    if stage in {"mix", "output"}:
        return "mixing"
    if stage == "convert":
        return "packaging"
    return ""


async def _apply_event(job: Job, event: dict, stems: list[dict]) -> None:
    kind = event.get("ev")
    if kind == "error":
        raise SourceError(
            event.get("code") or "SEPARATION_FAILED",
            event.get("message") or "分离失败",
            event.get("hint") or "",
        )
    if kind == "done":
        stems.extend(event.get("stems") or [])
        return

    stage = event.get("stage") or job.stage
    state = _stage_state(stage) or job.state
    pct = int(event.get("pct") or job.progress)
    message = event.get("message") or job.message
    store.update(job, state=state, stage=state, progress=pct, message=message)
    if message:
        store.add_event(job, message)


async def _run_separator(job: Job, source_path: Path) -> list[dict]:
    target = job_dir(job.id)
    argv = [
        sys.executable,
        "-m",
        "app.worker.separator_worker",
        "--input",
        str(source_path),
        "--outdir",
        str(target / "out"),
        "--workdir",
        str(target / "stems"),
        "--recipe",
        job.recipe,
        "--format",
        job.format,
        "--artist",
        ", ".join(job.track.get("artist") or []),
        "--title",
        job.track.get("name") or "",
    ]
    if job.stem_roles:
        argv += ["--stems", ",".join(job.stem_roles)]
    process = await asyncio.create_subprocess_exec(
        *argv,
        cwd=str(BASE_DIR),
        env={
            **os.environ,
            "PYTHONPATH": str(BASE_DIR),
            "PYTHONIOENCODING": "utf-8",
        },
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stderr_lines: list[str] = []

    async def drain() -> None:
        assert process.stderr is not None
        while True:
            line = await process.stderr.readline()
            if not line:
                break
            stderr_lines.append(line.decode("utf-8", "ignore").strip())
            if len(stderr_lines) > 25:
                del stderr_lines[:-25]

    drain_task = asyncio.create_task(drain())
    stems: list[dict] = []
    assert process.stdout is not None
    while True:
        line = await process.stdout.readline()
        if not line:
            break
        text = line.decode("utf-8", "ignore").strip()
        if not text or not text.startswith("{"):
            continue
        try:
            event = json.loads(text)
        except ValueError:
            continue
        await _apply_event(job, event, stems)
    await process.wait()
    await drain_task
    if process.returncode != 0:
        raise SourceError(
            "SEPARATION_FAILED",
            "分离进程异常退出",
            "；".join(stderr_lines[-3:])[:300] or "请查看服务端日志",
        )
    return stems


async def run_job(job: Job) -> None:
    store.update(job, started_at=time.time(), state="downloading", stage="downloading", progress=3)
    store.add_event(job, "开始获取音频")
    ensure_job_dir(job.id)

    try:
        if job.upload_id:
            source = upload_path(job.upload_id)
            if not source:
                raise SourceError("UPLOAD_MISSING", "上传文件不存在或已过期", "请重新上传音频")
            ext = source.suffix.lstrip(".") or "mp3"
            source_path = ensure_job_dir(job.id) / f"source.{ext}"
            shutil.move(str(source), source_path)
        else:
            resolved = await registry.resolve(job.track.get("source", ""), job.track.get("id", ""))
            track = dict(job.track)
            track.update(resolved.public())
            store.update(job, track=track)
            store.add_event(job, "已解析播放地址，开始下载")
            source_path = await download(resolved.stream_url, job_dir(job.id), settings.max_audio_mb)

        duration = await asyncio.to_thread(probe_duration, source_path)
        if duration and duration > settings.max_duration_sec:
            raise SourceError(
                "TOO_LONG",
                f"音频时长 {duration // 60} 分钟，超过上限 {settings.max_duration_sec // 60} 分钟",
                "请换用更短的片段或调整 MAX_DURATION_SEC",
            )
        pretty = f"{duration // 60}:{duration % 60:02d}" if duration else "未知"
        store.update(job, progress=10, message=f"已获取音频（{pretty}）")

        ensure_ffmpeg()
        store.update(job, state="separating_inst", stage="separating_inst", progress=12)
        stems = await _run_separator(job, source_path)
        if not stems:
            raise RuntimeError("分离进程未产出任何成品")

        store.update(job, state="packaging", stage="packaging", progress=98, message="打包成品")
        stems.sort(key=lambda item: STEM_ORDER.index(item["role"]) if item.get("role") in STEM_ORDER else 99)
        public = [
            {
                "id": item.get("role") or "stem",
                "label": item.get("label", ""),
                "description": item.get("description", ""),
                "filename": item.get("filename", ""),
                "size": int(item.get("size") or 0),
                "duration": int(item.get("duration") or 0),
                "url": f"/api/jobs/{job.id}/files/{item.get('role') or 'stem'}",
                "download_url": f"/api/jobs/{job.id}/files/{item.get('role') or 'stem'}?download=1",
            }
            for item in stems
        ]
        await asyncio.to_thread(_zip_outputs, job)
        store.update(
            job,
            state="done",
            stage="done",
            progress=100,
            message="成品已就绪",
            stems=public,
            finished_at=time.time(),
        )
        store.add_event(job, "全部分轨已完成")
    except SourceError as exc:
        _fail(job, exc.code, exc.message, exc.hint)
    except Exception as exc:  # noqa: BLE001
        _fail(job, "PIPELINE_FAILED", str(exc)[:300], "请重试；若持续失败请查看服务端日志")
