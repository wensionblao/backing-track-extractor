"""Separation worker (child process).

Protocol: one JSON object per stdout line. All human logs go to stderr.
"""
from __future__ import annotations

import argparse
import json
import logging
import shutil
import sys
from pathlib import Path

from app.config import settings
from app.services.storage import stem_filename
from app.worker.audio import convert, ensure_ffmpeg, mix_with_harmony, probe_duration
from app.worker.stems_map import RECIPE_STEMS, classify, meta


def emit(**payload) -> None:
    payload.setdefault("ev", "stage")
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def _run_model(model: str, source: Path, work_dir: Path, stage: str, start_pct: int, end_pct: int) -> list[str]:
    from audio_separator.separator import Separator

    emit(stage="load_model", model=model, pct=start_pct, message=f"加载模型 {model}")
    separator = Separator(
        output_dir=str(work_dir),
        model_file_dir=str(settings.models_path),
        output_format="wav",
    )
    separator.load_model(model_filename=model)
    emit(stage="separate", model=model, pct=start_pct + 2, message=f"分离中 · {model}")
    outputs = separator.separate(str(source))
    if isinstance(outputs, str):
        outputs = [outputs]
    files: list[str] = []
    for item in outputs:
        if not item:
            continue
        path = Path(item)
        if not path.is_absolute():
            path = work_dir / path.name
        files.append(str(path))
    emit(stage=stage, model=model, pct=end_pct, message="分离完成")
    return files


def _selftest() -> int:
    result = {"ffmpeg": False, "ffmpeg_path": "", "audio_separator": False, "version": "", "models": {}}
    try:
        result["ffmpeg_path"] = ensure_ffmpeg()
        result["ffmpeg"] = True
    except Exception as exc:  # noqa: BLE001
        result["ffmpeg_error"] = str(exc)
    try:
        import audio_separator

        result["audio_separator"] = True
        result["version"] = getattr(audio_separator, "__version__", "unknown")
    except Exception as exc:  # noqa: BLE001
        result["audio_separator_error"] = str(exc)
    for key, model in (("inst", settings.model_inst), ("kara", settings.model_kara)):
        result["models"][key] = (settings.models_path / model).exists()
    print(json.dumps({"ev": "selftest", **result}, ensure_ascii=False))
    return 0 if result["ffmpeg"] and result["audio_separator"] else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input")
    parser.add_argument("--outdir")
    parser.add_argument("--workdir")
    parser.add_argument("--recipe", default="karaoke")
    parser.add_argument("--stems", default="")
    parser.add_argument("--format", default="mp3")
    parser.add_argument("--artist", default="")
    parser.add_argument("--title", default="")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(stream=sys.stderr, level=logging.WARNING)

    if args.selftest:
        return _selftest()
    if not args.input or not args.outdir:
        emit(ev="error", code="BAD_ARGS", message="缺少 --input / --outdir")
        return 2

    source = Path(args.input)
    out_dir = Path(args.outdir)
    work_dir = Path(args.workdir or (out_dir / "work"))
    out_dir.mkdir(parents=True, exist_ok=True)
    work_dir.mkdir(parents=True, exist_ok=True)

    try:
        emit(stage="prepare", pct=1, message="检查 ffmpeg")
        ensure_ffmpeg()
        emit(stage="prepare", pct=3, message="ffmpeg 就绪")
    except Exception as exc:  # noqa: BLE001
        emit(ev="error", code="FFMPEG_MISSING", message=f"ffmpeg 不可用：{exc}")
        return 3

    recipe = args.recipe if args.recipe in RECIPE_STEMS else "karaoke"
    fmt = "wav" if args.format == "wav" else "mp3"
    produced: list[dict] = []

    # 显式音轨多选优先；为空时回退 recipe 预设
    wanted = [role.strip() for role in args.stems.split(",") if role.strip()] or list(
        RECIPE_STEMS[recipe]
    )

    try:
        inst_outputs = _run_model(
            settings.model_inst, source, work_dir, "separate_inst", 4, 48
        )
        inst = classify(inst_outputs)
        if "instrumental" not in inst:
            raise RuntimeError("分离结果中未找到伴奏轨，请检查模型输出")

        # 和声相关轨道任意一条被选中，都需要跑 KARA_2
        take_kara = bool(
            set(wanted) & {"instrumental_harmony", "vocal_lead", "vocal_harmony"}
        )
        vocal_track: str | None = inst.get("vocals")
        if take_kara:
            if not vocal_track:
                raise RuntimeError("分离结果中未找到人声轨，无法拆分和声")
            vocal_input = work_dir / "vocals_input.wav"
            shutil.copyfile(vocal_track, vocal_input)
            kara_outputs = _run_model(
                settings.model_kara, vocal_input, work_dir, "separate_kara", 50, 90
            )
            kara = classify(kara_outputs)
            if "vocals" not in kara:
                raise RuntimeError("和声拆分失败：未找到主唱轨")

        emit(stage="output", pct=91, message="整理成品")

        def add(role: str, src: Path) -> None:
            label, description = meta(role)
            filename = stem_filename(args.artist, args.title, label, fmt)
            dst = out_dir / filename
            if fmt == "wav" and src.suffix.lower() == ".wav":
                shutil.copyfile(src, dst)
            else:
                convert(src, dst, fmt)
            produced.append(
                {
                    "role": role,
                    "label": label,
                    "description": description,
                    "filename": filename,
                    "path": str(dst),
                    "size": dst.stat().st_size if dst.exists() else 0,
                    "duration": probe_duration(dst),
                }
            )

        if "instrumental_clean" in wanted:
            add("instrumental_clean", Path(inst["instrumental"]))
        if take_kara:
            harmony = kara.get("instrumental")
            lead = kara.get("vocals")
            if "vocal_harmony" in wanted and harmony:
                add("vocal_harmony", Path(harmony))
            if "vocal_lead" in wanted and lead:
                add("vocal_lead", Path(lead))
            if "instrumental_harmony" in wanted and harmony:
                emit(stage="mix", pct=93, message="合成和声伴奏")
                merged = work_dir / f"merged.{fmt}"
                mix_with_harmony(Path(inst["instrumental"]), Path(harmony), merged, fmt)
                label, description = meta("instrumental_harmony")
                filename = stem_filename(args.artist, args.title, label, fmt)
                dst = out_dir / filename
                shutil.copyfile(merged, dst)
                produced.append(
                    {
                        "role": "instrumental_harmony",
                        "label": label,
                        "description": description,
                        "filename": filename,
                        "path": str(dst),
                        "size": dst.stat().st_size if dst.exists() else 0,
                        "duration": probe_duration(dst),
                    }
                )
        if "vocal_all" in wanted and vocal_track:
            add("vocal_all", Path(vocal_track))

        emit(stage="convert", pct=97, message="转码完成", stems=produced)
        emit(ev="done", pct=100, stems=produced)
        return 0
    except Exception as exc:  # noqa: BLE001
        emit(ev="error", code="SEPARATION_FAILED", message=str(exc)[:500])
        return 4


if __name__ == "__main__":
    sys.exit(main())
