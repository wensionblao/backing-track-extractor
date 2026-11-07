"""ffmpeg discovery, conversion, mixing and duration probing."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

from app.config import settings

_CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0
_DURATION_RE = re.compile(r"Duration: (\d+):(\d+):(\d+\.?\d*)")


def ensure_ffmpeg() -> str:
    """Return an executable ffmpeg path and make its folder visible on PATH."""
    settings.tools_dir.mkdir(parents=True, exist_ok=True)
    if settings.ffmpeg_bin:
        candidate = Path(settings.ffmpeg_bin)
    else:
        import imageio_ffmpeg

        bundled = Path(imageio_ffmpeg.get_ffmpeg_exe())
        target = settings.tools_dir / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
        if not target.exists() or target.stat().st_size != bundled.stat().st_size:
            shutil.copy2(bundled, target)
            if sys.platform != "win32":
                target.chmod(0o755)
        candidate = target

    if not candidate.exists():
        raise RuntimeError(f"ffmpeg 未找到：{candidate}")

    folder = str(candidate.parent)
    current = os.environ.get("PATH", "")
    if folder not in current.split(os.pathsep):
        os.environ["PATH"] = folder + os.pathsep + current

    result = subprocess.run(
        [str(candidate), "-version"],
        capture_output=True,
        text=True,
        timeout=20,
        check=False,
        creationflags=_CREATE_NO_WINDOW,
    )
    if result.returncode != 0:
        raise RuntimeError("ffmpeg 无法执行")
    return str(candidate)


def ffmpeg_path() -> str:
    if settings.ffmpeg_bin:
        return settings.ffmpeg_bin
    exe = settings.tools_dir / ("ffmpeg.exe" if sys.platform == "win32" else "ffmpeg")
    return str(exe)


def run(args: list[str], timeout: int = 900) -> subprocess.CompletedProcess:
    return subprocess.run(
        [ffmpeg_path(), "-hide_banner", "-y", *args],
        capture_output=True,
        text=True,
        timeout=timeout,
        check=False,
        creationflags=_CREATE_NO_WINDOW,
    )


def probe_duration(path: Path) -> int:
    result = run(["-i", str(path)], timeout=60)
    match = _DURATION_RE.search(result.stderr or "")
    if not match:
        return 0
    hours, minutes, seconds = match.groups()
    return int(int(hours) * 3600 + int(minutes) * 60 + float(seconds))


def convert(src: Path, dst: Path, fmt: str) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if fmt == "wav":
        args = ["-i", str(src), "-vn", "-c:a", "pcm_s16le", str(dst)]
    else:
        args = ["-i", str(src), "-vn", "-c:a", "libmp3lame", "-b:a", "320k", str(dst)]
    result = run(args)
    if result.returncode != 0 or not dst.exists():
        raise RuntimeError(f"音频转码失败：{result.stderr.strip()[-300:]}")


def mix_with_harmony(instrumental: Path, harmony: Path, dst: Path, fmt: str) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    codec = ["-c:a", "pcm_s16le"] if fmt == "wav" else ["-c:a", "libmp3lame", "-b:a", "320k"]
    args = [
        "-i",
        str(instrumental),
        "-i",
        str(harmony),
        "-filter_complex",
        "[0:a][1:a]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95",
        *codec,
        str(dst),
    ]
    result = run(args)
    if result.returncode != 0 or not dst.exists():
        raise RuntimeError(f"和声伴奏混音失败：{result.stderr.strip()[-300:]}")


def probe_health() -> tuple[bool, str]:
    path = ffmpeg_path()
    if not Path(path).exists():
        return False, ""
    try:
        result = run(["-version"], timeout=20)
        return result.returncode == 0, path
    except (OSError, subprocess.SubprocessError):
        return False, path
