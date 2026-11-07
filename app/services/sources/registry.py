"""Source registry: search/resolve dispatch and link detection."""
from __future__ import annotations

from app.services.sources import netease, qq
from app.services.sources.base import ResolvedTrack, SourceError

SOURCES = {
    "netease": netease,
    "qq": qq,
}

SOURCE_META = [
    {
        "id": "netease",
        "name": "网易云音乐",
        "note": "歌名、歌曲链接或数字 id；部分版权曲需要 Cookie。",
        "accepts": "https://music.163.com/song?id=… / 数字 id",
        "searchable": True,
    },
    {
        "id": "qq",
        "name": "QQ 音乐",
        "note": "歌名、songmid 或数字 songid；高音质依赖登录状态。",
        "accepts": "https://y.qq.com/n/ryqq/songDetail/… / songmid",
        "searchable": True,
    },
    {
        "id": "upload",
        "name": "本地上传",
        "note": "mp3 / wav / flac / m4a / aac / ogg，单文件 ≤ 200MB。",
        "accepts": "本地音频文件",
        "searchable": False,
    },
]


def detect_source(text: str) -> str | None:
    value = (text or "").strip()
    if netease.parse_link(value):
        return "netease"
    if qq.parse_link(value):
        return "qq"
    return None


async def search(source: str, query: str, limit: int = 12) -> list[ResolvedTrack]:
    adapter = SOURCES.get(source)
    if not adapter:
        raise SourceError("UNKNOWN_SOURCE", "不支持的平台", f"可用平台：{', '.join(SOURCES)}")
    query = (query or "").strip()
    if not query:
        raise SourceError("INVALID_INPUT", "搜索词不能为空", "输入歌名、歌手或粘贴歌曲链接")
    return await adapter.search(query, limit=limit)


async def resolve(source: str, text: str) -> ResolvedTrack:
    adapter = SOURCES.get(source)
    if not adapter:
        raise SourceError("UNKNOWN_SOURCE", "不支持的平台", f"可用平台：{', '.join(SOURCES)}")
    return await adapter.resolve(text)
