"""In-memory job registry with disk manifests and a serial work queue."""
from __future__ import annotations

import asyncio
import time
import uuid
from contextlib import suppress
from dataclasses import asdict, dataclass, field

STAGE_LABELS = {
    "queued": "排队中",
    "downloading": "获取音频",
    "preparing": "准备模型",
    "separating_inst": "分离伴奏",
    "separating_kara": "拆分主唱与和声",
    "mixing": "合成和声伴奏",
    "packaging": "打包成品",
    "done": "完成",
    "failed": "失败",
}

ACTIVE_STATES = {"queued", "downloading", "preparing", "separating_inst", "separating_kara", "mixing", "packaging"}


@dataclass
class Job:
    id: str
    created_at: float
    track: dict
    recipe: str
    format: str
    upload_id: str | None = None
    stem_roles: list[str] = field(default_factory=list)
    state: str = "queued"
    stage: str = "queued"
    message: str = ""
    progress: int = 0
    stems: list[dict] = field(default_factory=list)
    error: dict | None = None
    started_at: float | None = None
    finished_at: float | None = None
    events: list[dict] = field(default_factory=list)
    version: int = 0

    def touch(self) -> None:
        self.version += 1

    def add_event(self, text: str) -> None:
        self.events.append({"ts": int(time.time()), "text": text})
        self.events = self.events[-30:]

    def elapsed(self) -> int:
        end = self.finished_at or time.time()
        return int(end - (self.started_at or self.created_at))

    def manifest(self) -> dict:
        data = asdict(self)
        return data


class JobStore:
    def __init__(self) -> None:
        self.jobs: dict[str, Job] = {}
        self.queue: asyncio.Queue[str] = asyncio.Queue()
        self._tasks: list[asyncio.Task] = []
        self._stop = asyncio.Event()

    # -- persistence -------------------------------------------------
    def load_history(self) -> None:
        from app.config import settings
        from app.services.storage import read_manifest

        if not settings.jobs_dir.exists():
            return
        for folder in settings.jobs_dir.iterdir():
            if not folder.is_dir():
                continue
            data = read_manifest(folder.name)
            if not data:
                continue
            try:
                known = {f for f in Job.__dataclass_fields__}
                job = Job(**{k: v for k, v in data.items() if k in known})
            except TypeError:
                continue
            if job.state in ACTIVE_STATES:
                job.state = "failed"
                job.stage = "failed"
                job.progress = 100
                job.error = {
                    "code": "INTERRUPTED",
                    "message": "服务重启导致任务中断",
                    "hint": "请重新发起分离",
                }
                job.finished_at = time.time()
            self.jobs[job.id] = job

    def _persist(self, job: Job) -> None:
        from app.services.storage import write_manifest

        try:
            write_manifest(job.id, job.manifest())
        except OSError:
            pass

    # -- lifecycle ---------------------------------------------------
    async def start(self, runner, count: int = 1) -> None:
        self._stop.clear()
        for _ in range(max(1, count)):
            self._tasks.append(asyncio.create_task(self._worker(runner)))

    async def stop(self) -> None:
        self._stop.set()
        for task in self._tasks:
            task.cancel()
        for task in self._tasks:
            with suppress(asyncio.CancelledError):
                await task
        self._tasks.clear()

    async def _worker(self, runner) -> None:
        while not self._stop.is_set():
            try:
                job_id = await asyncio.wait_for(self.queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            job = self.jobs.get(job_id)
            if not job:
                self.queue.task_done()
                continue
            try:
                await runner(job)
            except Exception as exc:  # noqa: BLE001
                self.update(
                    job,
                    state="failed",
                    stage="failed",
                    progress=100,
                    finished_at=time.time(),
                    error={"code": "INTERNAL", "message": str(exc)[:300], "hint": "请重试"},
                )
                job.add_event(f"任务异常：{exc}")
                self._persist(job)
            finally:
                self.queue.task_done()

    # -- API ---------------------------------------------------------
    def create(
        self,
        track: dict,
        recipe: str,
        fmt: str,
        upload_id: str | None,
        stem_roles: list[str] | None = None,
    ) -> Job:
        from app.services.storage import ensure_job_dir

        job_id = uuid.uuid4().hex
        ensure_job_dir(job_id)
        job = Job(
            id=job_id,
            created_at=time.time(),
            track=track,
            recipe=recipe,
            format=fmt,
            upload_id=upload_id,
            stem_roles=stem_roles or [],
        )
        job.add_event("任务已创建，等待处理")
        self.jobs[job_id] = job
        self._persist(job)
        self.queue.put_nowait(job_id)
        return job

    def get(self, job_id: str) -> Job | None:
        return self.jobs.get(job_id)

    def update(self, job: Job, **fields) -> None:
        for key, value in fields.items():
            setattr(job, key, value)
        job.touch()
        self._persist(job)

    def add_event(self, job: Job, text: str) -> None:
        job.add_event(text)
        job.touch()

    def queue_position(self, job: Job) -> int:
        if job.state != "queued":
            return 0
        ahead = sum(
            1
            for other in self.jobs.values()
            if other.state == "queued" and other.created_at < job.created_at
        )
        return ahead + 1

    def stats(self) -> tuple[int, int, int]:
        queued = sum(1 for job in self.jobs.values() if job.state == "queued")
        running = sum(1 for job in self.jobs.values() if job.state in ACTIVE_STATES - {"queued"})
        return queued, running, len(self.jobs)

    def to_view(self, job: Job) -> dict:
        return {
            "id": job.id,
            "state": job.state,
            "stage": job.stage,
            "stage_label": STAGE_LABELS.get(job.stage, job.stage),
            "progress": job.progress,
            "message": job.message,
            "created_at": int(job.created_at),
            "elapsed": job.elapsed(),
            "queue_position": self.queue_position(job),
            "track": job.track,
            "recipe": job.recipe,
            "format": job.format,
            "stem_roles": job.stem_roles,
            "stems": job.stems,
            "zip_url": f"/api/jobs/{job.id}/zip" if job.stems else "",
            "error": job.error,
            "events": [event["text"] for event in job.events],
        }


store = JobStore()
