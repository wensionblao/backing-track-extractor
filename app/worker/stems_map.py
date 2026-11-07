"""Central mapping between audio-separator outputs and product stems."""
from __future__ import annotations

import re
from pathlib import Path

STEM_META = {
    "instrumental_clean": ("去和声伴奏", "无主唱、无和声，最干净的伴奏"),
    "instrumental_harmony": ("和声伴奏", "保留背景和声，适合带和声的舞台版本"),
    "vocal_lead": ("无和声人声", "只有主唱，可用于对齐或二次混音"),
    "vocal_harmony": ("仅和声", "只有背景和声，方便单独调节"),
    "vocal_all": ("全人声", "主唱 + 和声的完整人声轨"),
}

RECIPE_STEMS = {
    "quick": ["instrumental_clean"],
    "karaoke": [
        "instrumental_clean",
        "instrumental_harmony",
        "vocal_lead",
        "vocal_harmony",
        "vocal_all",
    ],
    "acapella": ["vocal_all", "vocal_lead", "vocal_harmony"],
}

RECIPE_MODEL_RUNS = {"quick": 1, "karaoke": 2, "acapella": 2}


def _stem_key(path: str) -> str:
    name = Path(path).stem
    groups = re.findall(r"\(([^)]+)\)", name)
    key = groups[-1].lower() if groups else name.lower()
    if "instrument" in key or key in {"inst", "other", "others"}:
        return "instrumental"
    if "vocal" in key or "voice" in key:
        return "vocals"
    return "unknown"


def classify(files: list[str]) -> dict[str, str]:
    """Map raw separator outputs to {'instrumental': path, 'vocals': path}."""
    result: dict[str, str] = {}
    for path in files:
        key = _stem_key(path)
        if key in {"instrumental", "vocals"} and key not in result:
            result[key] = path
    return result


def meta(role: str) -> tuple[str, str]:
    return STEM_META.get(role, (role, ""))
