"""HTTP API: sources, search, upload, jobs, SSE, files."""
from __future__ import annotations

import asyncio
import json
import time
import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from app.config import settings
from app.schemas import (
    CreateJobRequest,
    HealthResponse,
    RecipeInfo,
    ResolveRequest,
    SearchResponse,
    Track,
    UploadResponse,
)
from app.services.jobs import STAGE_LABELS, store
from app.services.ratelimit import RateLimiter
from app.services.sources import registry
from app.services.storage import job_dir, upload_path
from app.worker.audio import ensure_ffmpeg, probe_duration

router = APIRouter(prefix="/api")
limiter = RateLimiter(settings.rate_limit_per_min)

ALLOWED_EXT = {"mp3", "wav", "flac", "m4a", "aac", "ogg"}
MAGIC_EXT = [
    (b"ID3", "mp3"),
    (b"\xff\xfb", "mp3"),
    (b"\xff\xf3", "mp3"),
    (b"\xff\xf1", "aac"),
    (b"fLaC", "flac"),
    (b"RIFF", "wav"),
    (b"OggS", "ogg"),
]

_health_cache: dict = {"at": 0.0, "value": None}


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _guard(request: Request) -> None:
    if not limiter.allow(_client_key(request)):
        raise HTTPException(
            status_code=429,
            detail={"code": "RATE_LIMITED", "message": "请求过于频繁", "hint": "请稍后再试"},
        )


def _audio_ext(head: bytes, filename: str) -> str | None:
    for magic, ext in MAGIC_EXT:
        if head.startswith(magic):
            return ext
    if head[4:8] == b"ftyp":
        return "m4a"
    ext = Path(filename or "").suffix.lower().lstrip(".")
    return ext if ext in ALLOWED_EXT else None


def _job_or_404(job_id: str):
    job = store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=404,
            detail={"code": "JOB_NOT_FOUND", "message": "任务不存在或已过期", "hint": "请重新发起分离"},
        )
    return job


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    now = time.time()
    if _health_cache["value"] and now - _health_cache["at"] < 60:
        return _health_cache["value"]

    hints: list[str] = []
    ffmpeg_ok = False
    ffmpeg_bin = ""
    try:
        ffmpeg_bin = await asyncio.to_thread(ensure_ffmpeg)
        ffmpeg_ok = True
    except Exception as exc:  # noqa: BLE001
        hints.append(f"ffmpeg 不可用：{exc}")

    separator_ok = False
    version = ""
    try:
        import audio_separator

        separator_ok = True
        version = getattr(audio_separator, "__version__", "unknown")
    except Exception as exc:  # noqa: BLE001
        hints.append(f"audio-separator 导入失败：{exc}")

    models = {
        "inst": (settings.models_path / settings.model_inst).exists(),
        "kara": (settings.models_path / settings.model_kara).exists(),
    }
    if not all(models.values()):
        hints.append("模型尚未下载，首个任务会自动下载（约 60–100MB/个）")

    queued, running, total = store.stats()
    payload = HealthResponse(
        ok=ffmpeg_ok and separator_ok,
        app=settings.app_name,
        python=".".join(str(part) for part in __import__("sys").version_info[:3]),
        ffmpeg=ffmpeg_ok,
        ffmpeg_path=ffmpeg_bin,
        audio_separator=separator_ok,
        audio_separator_version=version,
        models=models,
        device=settings.separator_device,
        queue=queued,
        running=running,
        jobs_total=total,
        hints=hints,
    )
    _health_cache.update({"at": now, "value": payload})
    return payload


@router.get("/sources")
async def sources() -> dict:
    return {"items": registry.SOURCE_META}


@router.get("/search", response_model=SearchResponse)
async def search(request: Request, source: str, q: str = Query(..., min_length=1), limit: int = 12):
    _guard(request)
    items = await registry.search(source, q, limit=min(max(limit, 1), 20))
    return SearchResponse(
        source=source,
        query=q,
        items=[Track(**item.public()) for item in items],
    )


@router.post("/resolve")
async def resolve(request: Request, body: ResolveRequest):
    _guard(request)
    if body.source == "upload":
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_INPUT", "message": "上传文件无需解析", "hint": "请直接创建任务"},
        )
    track = await registry.resolve(body.source, body.input)
    return {
        "track": track.public(),
        "playable": track.playable,
        "reason": track.reason,
    }


@router.post("/uploads", response_model=UploadResponse)
async def upload(request: Request, file: UploadFile = File(...)):  # noqa: B008
    _guard(request)
    head = await file.read(16)
    ext = _audio_ext(head, file.filename or "")
    if not ext:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_FILE", "message": "不支持的音频格式", "hint": "支持 mp3 / wav / flac / m4a / aac / ogg"},
        )

    upload_id = uuid.uuid4().hex
    target = settings.uploads_dir / f"{upload_id}.{ext}"
    limit = settings.max_upload_mb * 1024 * 1024
    written = 0
    try:
        with target.open("wb") as handle:
            handle.write(head)
            written += len(head)
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                written += len(chunk)
                if written > limit:
                    raise HTTPException(
                        status_code=413,
                        detail={
                            "code": "TOO_LARGE",
                            "message": f"文件超过 {settings.max_upload_mb} MB",
                            "hint": "请上传更短的音频，或调整 MAX_UPLOAD_MB",
                        },
                    )
                handle.write(chunk)
    except HTTPException:
        target.unlink(missing_ok=True)
        raise
    finally:
        await file.close()

    duration = await asyncio.to_thread(probe_duration, target)
    return UploadResponse(
        uploadId=upload_id,
        filename=file.filename or target.name,
        size=written,
        duration=duration,
    )


@router.get("/recipes", response_model=list[RecipeInfo])
async def recipes() -> list[RecipeInfo]:
    return [
        RecipeInfo(
            id="quick",
            name="快速纯伴奏",
            tagline="只要一条干净的伴奏，最快出片",
            stems=["去和声伴奏"],
            model_runs=1,
            eta_seconds=90,
        ),
        RecipeInfo(
            id="karaoke",
            name="全套分轨",
            tagline="主唱、和声、伴奏一次拿齐",
            stems=["去和声伴奏", "和声伴奏", "无和声人声", "仅和声", "全人声"],
            model_runs=2,
            eta_seconds=240,
            recommended=True,
        ),
        RecipeInfo(
            id="acapella",
            name="纯人声",
            tagline="主唱与和声分离，方便二次创作",
            stems=["全人声", "无和声人声", "仅和声"],
            model_runs=2,
            eta_seconds=240,
        ),
    ]


@router.post("/jobs")
async def create_job(request: Request, body: CreateJobRequest):
    _guard(request)

    from app.worker.stems_map import STEM_META

    stem_roles: list[str] = []
    if body.stems:
        seen: set[str] = set()
        for role in body.stems:
            if role in STEM_META and role not in seen:
                seen.add(role)
                stem_roles.append(role)
        if not stem_roles:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_STEMS", "message": "请至少选择一条要生成的音轨", "hint": ""},
            )

    if body.uploadId:
        source_file = upload_path(body.uploadId)
        if not source_file:
            raise HTTPException(
                status_code=404,
                detail={"code": "UPLOAD_MISSING", "message": "上传文件不存在或已过期", "hint": "请重新上传"},
            )
        track = {
            "id": body.uploadId,
            "source": "upload",
            "name": source_file.stem,
            "artist": [],
            "album": "",
            "duration": 0,
            "cover": "",
            "link": "",
        }
        job = store.create(
            track=track,
            recipe=body.recipe,
            fmt=body.format,
            upload_id=body.uploadId,
            stem_roles=stem_roles,
        )
    elif body.track:
        if body.track.source not in {"netease", "qq"}:
            raise HTTPException(
                status_code=400,
                detail={"code": "INVALID_INPUT", "message": "请选择有效的平台歌曲", "hint": ""},
            )
        job = store.create(
            track=body.track.model_dump(),
            recipe=body.recipe,
            fmt=body.format,
            upload_id=None,
            stem_roles=stem_roles,
        )
    else:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_INPUT", "message": "缺少歌曲或上传文件", "hint": ""},
        )

    return {"jobId": job.id, "job": store.to_view(job)}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = _job_or_404(job_id)
    return store.to_view(job)


@router.get("/jobs/{job_id}/events")
async def job_events(job_id: str, request: Request):
    job = _job_or_404(job_id)

    async def generator():
        last_version = -1
        while True:
            if await request.is_disconnected():
                break
            if job.version != last_version:
                payload = json.dumps(store.to_view(job), ensure_ascii=False)
                yield f"event: job\ndata: {payload}\n\n"
                last_version = job.version
                if job.state in {"done", "failed"}:
                    break
            else:
                yield ": keep-alive\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/jobs/{job_id}/files/{stem_id}")
async def job_file(job_id: str, stem_id: str, download: int = 0):
    job = _job_or_404(job_id)
    stem = next((item for item in job.stems if item["id"] == stem_id), None)
    if not stem:
        raise HTTPException(status_code=404, detail={"code": "STEM_NOT_FOUND", "message": "分轨不存在", "hint": ""})
    filename = stem.get("filename") or ""
    if Path(filename).name != filename:
        raise HTTPException(status_code=400, detail={"code": "INVALID_PATH", "message": "文件名非法", "hint": ""})
    path = job_dir(job_id) / "out" / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail={"code": "FILE_MISSING", "message": "文件已清理", "hint": ""})
    media = "audio/wav" if path.suffix.lower() == ".wav" else "audio/mpeg"
    return FileResponse(
        path,
        media_type=media,
        filename=filename if download else None,
        content_disposition_type="attachment" if download else "inline",
    )


@router.get("/jobs/{job_id}/zip")
async def job_zip(job_id: str):
    job = _job_or_404(job_id)
    path = job_dir(job_id) / "stems.zip"
    if not path.exists():
        raise HTTPException(status_code=404, detail={"code": "ZIP_MISSING", "message": "压缩包尚未生成", "hint": ""})
    title = "-".join([*(job.track.get("artist") or []), job.track.get("name") or "stems"])[:60]
    return FileResponse(path, media_type="application/zip", filename=f"{title}.zip")


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    from app.services.storage import remove_job_dir, valid_job_id

    if not valid_job_id(job_id):
        raise HTTPException(status_code=404, detail={"code": "JOB_NOT_FOUND", "message": "任务不存在", "hint": ""})
    store.jobs.pop(job_id, None)
    await asyncio.to_thread(remove_job_dir, job_id)
    return {"ok": True}


@router.get("/meta")
async def meta() -> dict:
    return {
        "app": settings.app_name,
        "stages": STAGE_LABELS,
        "limits": {
            "max_upload_mb": settings.max_upload_mb,
            "max_duration_sec": settings.max_duration_sec,
            "job_ttl_hours": settings.job_ttl_hours,
        },
    }
