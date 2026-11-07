"""Streaming audio downloader with size and type guards."""
from __future__ import annotations

from pathlib import Path
from urllib.parse import urlparse

import httpx

from app.config import settings
from app.services.sources.base import SourceError

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
MIME_EXT = {
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/flac": "flac",
    "audio/x-flac": "flac",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
}
MAGIC_EXT = [
    (b"ID3", "mp3"),
    (b"\xff\xfb", "mp3"),
    (b"\xff\xf3", "mp3"),
    (b"\xff\xf1", "aac"),
    (b"fLaC", "flac"),
    (b"RIFF", "wav"),
    (b"OggS", "ogg"),
]


def _referer(url: str) -> str:
    host = urlparse(url).netloc
    if "qq.com" in host or "qqmusic" in host:
        return "https://y.qq.com/"
    if "163.com" in host or "126.net" in host:
        return "https://music.163.com/"
    return ""


def _detect_ext(first_bytes: bytes, content_type: str, url: str) -> str:
    for magic, ext in MAGIC_EXT:
        if first_bytes.startswith(magic):
            return ext
    if first_bytes[4:8] == b"ftyp":
        return "m4a"
    mime = (content_type or "").split(";")[0].strip().lower()
    if mime in MIME_EXT:
        return MIME_EXT[mime]
    suffix = urlparse(url).path.rsplit(".", 1)[-1].lower()
    if suffix in {"mp3", "flac", "m4a", "aac", "wav", "ogg"}:
        return suffix
    return "mp3"


async def download(url: str, target_dir: Path, max_mb: int | None = None) -> Path:
    if not url.startswith(("http://", "https://")):
        raise SourceError("DOWNLOAD_FAILED", "音频地址无效", "平台返回了异常地址，请重试或改用上传")
    limit = (max_mb or settings.max_audio_mb) * 1024 * 1024
    headers = {"User-Agent": UA}
    referer = _referer(url)
    if referer:
        headers["Referer"] = referer

    target_dir.mkdir(parents=True, exist_ok=True)
    partial = target_dir / "source.part"
    written = 0
    first = b""
    try:
        async with (
            httpx.AsyncClient(timeout=httpx.Timeout(20, read=60), follow_redirects=True) as client,
            client.stream("GET", url, headers=headers) as response,
        ):
            if response.status_code >= 400:
                raise SourceError(
                    "DOWNLOAD_FAILED",
                    f"音频下载失败（HTTP {response.status_code}）",
                    "该直链可能已过期或需要登录，请重试或改用上传。",
                )
            content_length = int(response.headers.get("content-length") or 0)
            if content_length and content_length > limit:
                raise SourceError("TOO_LARGE", "音频文件超过大小限制", "请改用更短的音频或提高 MAX_AUDIO_MB")
            with partial.open("wb") as handle:
                async for chunk in response.aiter_bytes(64 * 1024):
                    if not first:
                        first = chunk[:16]
                    written += len(chunk)
                    if written > limit:
                        raise SourceError(
                            "TOO_LARGE", "音频文件超过大小限制", "请改用更短的音频或提高 MAX_AUDIO_MB"
                        )
                    handle.write(chunk)
            content_type = response.headers.get("content-type", "")
    except SourceError:
        partial.unlink(missing_ok=True)
        raise
    except httpx.HTTPError as exc:
        partial.unlink(missing_ok=True)
        raise SourceError("DOWNLOAD_FAILED", f"音频下载失败：{exc.__class__.__name__}", "请检查网络后重试") from exc

    if written == 0:
        partial.unlink(missing_ok=True)
        raise SourceError("DOWNLOAD_FAILED", "下载到的音频为空", "平台可能限制了该请求，请改用上传")

    ext = _detect_ext(first, content_type, url)
    final = target_dir / f"source.{ext}"
    partial.replace(final)
    return final
