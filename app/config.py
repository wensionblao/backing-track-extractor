"""Application configuration. All values can be overridden via environment/.env."""
from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="ignore")

    app_name: str = "拆声 STEMS"
    app_port: int = 8000

    storage_dir: Path = BASE_DIR / "storage"
    models_dir: Path | None = None
    ffmpeg_bin: str = ""

    # Platform cookies are optional; without them only free/standard tracks resolve.
    netease_cookie: str = ""
    qq_cookie: str = ""

    # Separation models (file names from the audio-separator model catalogue).
    model_inst: str = "UVR-MDX-NET-Inst_HQ_3.onnx"
    model_kara: str = "UVR_MDXNET_KARA_2.onnx"
    separator_device: str = "auto"  # auto | cpu | dml | cuda
    separator_workers: int = 1

    job_ttl_hours: int = 24
    max_upload_mb: int = 200
    max_audio_mb: int = 150
    max_duration_sec: int = 900
    rate_limit_per_min: int = 30

    @property
    def jobs_dir(self) -> Path:
        return self.storage_dir / "jobs"

    @property
    def uploads_dir(self) -> Path:
        return self.storage_dir / "uploads"

    @property
    def models_path(self) -> Path:
        return self.models_dir or (self.storage_dir / "models")

    @property
    def tools_dir(self) -> Path:
        return self.storage_dir / "bin"

    def ensure_dirs(self) -> None:
        for path in (self.jobs_dir, self.uploads_dir, self.models_path, self.tools_dir):
            path.mkdir(parents=True, exist_ok=True)


settings = Settings()
