"""FastAPI application entrypoint."""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router
from app.config import BASE_DIR, settings
from app.services.jobs import store
from app.services.pipeline import run_job
from app.services.sources.base import SourceError
from app.services.storage import cleanup_expired

WEB_DIST = BASE_DIR / "web" / "dist"


async def _cleaner() -> None:
    while True:
        await asyncio.sleep(1800)
        removed = await asyncio.to_thread(cleanup_expired, settings.job_ttl_hours)
        for name in removed:
            store.jobs.pop(name, None)


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.ensure_dirs()
    store.load_history()
    await store.start(run_job, settings.separator_workers)
    cleaning = asyncio.create_task(_cleaner())
    try:
        yield
    finally:
        cleaning.cancel()
        await store.stop()


app = FastAPI(title=settings.app_name, lifespan=lifespan)
app.include_router(router)


@app.exception_handler(SourceError)
async def source_error_handler(_: Request, exc: SourceError):
    status = 400 if exc.code in {"INVALID_INPUT", "TRACK_NOT_FOUND", "UPLOAD_MISSING"} else 502
    return JSONResponse(
        status_code=status,
        content={"code": exc.code, "message": exc.message, "hint": exc.hint},
    )


if WEB_DIST.exists():
    app.mount("/", StaticFiles(directory=str(WEB_DIST), html=True), name="web")


@app.get("/")
async def root() -> dict:
    if WEB_DIST.exists():
        return {"app": settings.app_name}
    return {
        "app": settings.app_name,
        "message": "前端尚未构建，请在 web/ 执行 pnpm install && pnpm build",
        "docs": "/docs",
    }
