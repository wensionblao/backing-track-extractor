"""QQ Music adapter (search / detail / vkey play-url)."""
from __future__ import annotations

import random
import re

import httpx

from app.config import settings
from app.services.sources.base import ResolvedTrack, SourceError, normalize_duration

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
MUSICU = "https://u.y.qq.com/cgi-bin/musicu.fcg"
BASE_HEADERS = {
    "User-Agent": UA,
    "Referer": "https://y.qq.com/",
    "Origin": "https://y.qq.com",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}


def headers() -> dict[str, str]:
    values = dict(BASE_HEADERS)
    if settings.qq_cookie:
        values["Cookie"] = settings.qq_cookie
    return values


def parse_link(text: str) -> tuple[str, str] | None:
    """Return (kind, value) where kind is 'mid' or 'songid', or None."""
    value = (text or "").strip()
    match = re.search(r"y\.qq\.com/(?:n/ryqq/songDetail|song)/([0-9A-Za-z]+)", value)
    if match:
        return "mid", match.group(1)
    match = re.search(r"(?:[?&]|^)songmid=([0-9A-Za-z]+)", value)
    if match:
        return "mid", match.group(1)
    if value.isdigit():
        return "songid", value
    if re.fullmatch(r"[0-9A-Za-z]{8,14}", value):
        return "mid", value
    return None


def _cover(album_mid: str) -> str:
    return f"https://y.qq.com/music/photo_new/T002R300x300M000{album_mid}.jpg" if album_mid else ""


def _parse_song(raw: dict) -> ResolvedTrack:
    album = raw.get("album") or {}
    singers = raw.get("singer") or []
    mid = raw.get("mid") or raw.get("songmid") or ""
    file_info = raw.get("file") or {}
    duration = normalize_duration(raw.get("interval") or file_info.get("duration"))
    return ResolvedTrack(
        id=mid,
        source="qq",
        name=raw.get("name") or raw.get("songname") or "未命名歌曲",
        artist=[item.get("name", "") for item in singers if isinstance(item, dict)],
        album=album.get("name") or raw.get("albumname") or "",
        duration=duration,
        cover=_cover(album.get("mid") or raw.get("albummid") or ""),
        link=f"https://y.qq.com/n/ryqq/songDetail/{mid}" if mid else "",
        media_mid=file_info.get("media_mid") or raw.get("media_mid") or mid,
    )


async def search(query: str, limit: int = 12) -> list[ResolvedTrack]:
    params = {
        "w": query,
        "format": "json",
        "p": 1,
        "n": limit,
        "cr": 1,
        "g_tk": 5381,
        "t": 0,
        "flag_qc": 0,
    }
    async with httpx.AsyncClient(timeout=15, headers=headers(), follow_redirects=True) as client:
        response = await client.get("https://c.y.qq.com/soso/fcgi-bin/client_search_cp", params=params)
        payload = response.json()
    items = (((payload.get("data") or {}).get("song") or {}).get("list")) or []
    return [_parse_song(item) for item in items if item.get("songmid") or item.get("mid")]


async def _detail(kind: str, value: str) -> ResolvedTrack:
    params = {"platform": "yqq", "format": "json"}
    params["songid" if kind == "songid" else "songmid"] = value
    async with httpx.AsyncClient(timeout=15, headers=headers(), follow_redirects=True) as client:
        response = await client.get(
            "https://c.y.qq.com/v8/fcg-bin/fcg_play_single_song.fcg", params=params
        )
        payload = response.json()
        songs = payload.get("data") or []
        if isinstance(songs, dict):
            songs = [songs]
        if not songs:
            raise SourceError("TRACK_NOT_FOUND", "QQ 音乐未找到该歌曲", "请检查 songmid / songid 或改用搜索")
        return _parse_song(songs[0])


async def _vkey(songmid: str, media_mid: str, prefix: str, ext: str) -> tuple[str, int]:
    guid = str(random.randint(10000000, 99999999))
    filename = f"{prefix}{songmid}{media_mid or songmid}.{ext}"
    body = {
        "req_0": {
            "module": "vkey.GetVkeyServer",
            "method": "CgiGetVkey",
            "param": {
                "guid": guid,
                "songmid": [songmid],
                "songtype": [0],
                "uin": "0",
                "loginflag": 1,
                "platform": "20",
                "filename": [filename],
            },
        },
        "comm": {
            "uin": 0,
            "format": "json",
            "ct": 24,
            "cv": 0,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=15, headers=headers(), follow_redirects=True) as client:
            response = await client.post(MUSICU, json=body)
            payload = response.json()
    except (httpx.HTTPError, ValueError):
        return "", 0
    req = payload.get("req_0") or {}
    data = req.get("data") or {}
    info = (data.get("midurlinfo") or [{}])[0]
    purl = info.get("purl") or ""
    if not purl:
        return "", 0
    sip = [item for item in (data.get("sip") or []) if not item.startswith("http://ws")]
    domain = sip[0] if sip else (data.get("sip") or [""])[0]
    bitrate = {"M800": 320, "M500": 128, "F000": 999}.get(prefix, 0)
    return f"{domain}{purl}", bitrate


async def resolve_stream(track: ResolvedTrack) -> ResolvedTrack:
    if not track.id:
        raise SourceError("INVALID_INPUT", "缺少 QQ songmid", "请粘贴歌曲链接或输入 songmid")
    qualities = [("M800", "mp3"), ("M500", "mp3"), ("F000", "flac")]
    for prefix, ext in qualities:
        for _ in range(3):
            url, bitrate = await _vkey(track.id, track.media_mid, prefix, ext)
            if url:
                track.stream_url = url
                track.ext = ext
                track.bitrate = bitrate
                track.playable = True
                return track
    raise SourceError(
        "URL_UNAVAILABLE",
        f"《{track.name}》需要登录或 VIP，或该曲目暂无版权",
        "可在 .env 配置 QQ_COOKIE 后重试，或改用本地上传。",
    )


async def resolve(source_input: str) -> ResolvedTrack:
    parsed = parse_link(source_input)
    if not parsed:
        raise SourceError(
            "INVALID_INPUT",
            "无法识别 QQ 音乐歌曲",
            "请粘贴 y.qq.com 歌曲链接、输入 songmid（12 位字母数字）或数字 songid",
        )
    track = await _detail(*parsed)
    return await resolve_stream(track)
