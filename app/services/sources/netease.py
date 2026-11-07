"""NetEase Cloud Music adapter (search / detail / signed play-url)."""
from __future__ import annotations

import base64
import json
import random
import re
import string
from urllib.parse import urlparse

import httpx
from Crypto.Cipher import AES

from app.config import settings
from app.services.sources.base import ResolvedTrack, SourceError, normalize_duration

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
BASE_HEADERS = {
    "User-Agent": UA,
    "Referer": "https://music.163.com/",
    "Origin": "https://music.163.com",
    "Accept": "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

_NONCE = "0CoJUm6Qyw8W8jud"
_IV = b"0102030405060708"
_PUBKEY = "010001"
_MODULUS = (
    "00e0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7"
)


def _aes_encrypt(text: str, key: str) -> str:
    pad = 16 - len(text) % 16
    payload = (text + chr(pad) * pad).encode("utf-8")
    return base64.b64encode(AES.new(key.encode("utf-8"), AES.MODE_CBC, _IV).encrypt(payload)).decode()


def _rsa_encrypt(secret: str) -> str:
    reversed_hex = secret[::-1].encode("utf-8").hex()
    value = pow(int(reversed_hex, 16), int(_PUBKEY, 16), int(_MODULUS, 16))
    return format(value, "x").zfill(256)


def weapi(payload: dict) -> dict[str, str]:
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    secret = "".join(random.choices(string.ascii_letters + string.digits, k=16))
    params = _aes_encrypt(_aes_encrypt(text, _NONCE), secret)
    return {"params": params, "encSecKey": _rsa_encrypt(secret)}


def headers() -> dict[str, str]:
    values = dict(BASE_HEADERS)
    if settings.netease_cookie:
        values["Cookie"] = settings.netease_cookie
    return values


def _ext_from_url(url: str, fallback: str = "mp3") -> str:
    suffix = urlparse(url).path.rsplit(".", 1)[-1].lower()
    return suffix if suffix in {"mp3", "flac", "m4a", "aac", "wav", "ogg"} else fallback


def parse_link(text: str) -> str | None:
    match = re.search(r"music\.163\.com.*?[?&#/]id=(\d+)", text)
    return match.group(1) if match else None


def _parse_song(raw: dict) -> ResolvedTrack:
    album = raw.get("al") or raw.get("album") or {}
    artists = raw.get("ar") or raw.get("artists") or []
    if isinstance(artists, list):
        names = [item.get("name", "") for item in artists if isinstance(item, dict)]
    else:
        names = []
    song_id = str(raw.get("id", ""))
    duration = normalize_duration(raw.get("dt") or raw.get("duration")) // 1000
    cover = album.get("picUrl") or ""
    return ResolvedTrack(
        id=song_id,
        source="netease",
        name=raw.get("name") or "未命名歌曲",
        artist=names,
        album=album.get("name", ""),
        duration=duration,
        cover=cover,
        link=f"https://music.163.com/#/song?id={song_id}",
    )


async def search(query: str, limit: int = 12) -> list[ResolvedTrack]:
    params = {
        "csrf_token": "",
        "s": query,
        "type": 1,
        "offset": 0,
        "total": "true",
        "limit": limit,
    }
    async with httpx.AsyncClient(timeout=15, headers=headers(), follow_redirects=True) as client:
        try:
            response = await client.get("https://music.163.com/api/search/get/web", params=params)
            payload = response.json()
            songs = (payload.get("result") or {}).get("songs") or []
        except (httpx.HTTPError, ValueError):
            songs = []
        if not songs:
            response = await client.post(
                "https://music.163.com/weapi/cloudsearch/get/web?csrf_token=",
                data=weapi({"s": query, "type": 1, "offset": 0, "total": True, "limit": limit}),
            )
            payload = response.json()
            songs = (payload.get("result") or {}).get("songs") or []
    return [_parse_song(item) for item in songs if item.get("id")]


async def detail(song_id: str) -> ResolvedTrack:
    async with httpx.AsyncClient(timeout=15, headers=headers(), follow_redirects=True) as client:
        response = await client.get(
            "https://music.163.com/api/song/detail", params={"ids": f"[{song_id}]"}
        )
        payload = response.json()
    songs = payload.get("songs") or []
    if not songs:
        raise SourceError("TRACK_NOT_FOUND", "网易云未找到该歌曲", "请检查歌曲 ID 或改用搜索")
    return _parse_song(songs[0])


async def resolve_stream(track: ResolvedTrack) -> ResolvedTrack:
    level = "exhigh" if settings.netease_cookie else "standard"
    payload = {"ids": json.dumps([int(track.id)]), "level": level, "encodeType": "flac"}
    async with httpx.AsyncClient(timeout=20, headers=headers(), follow_redirects=True) as client:
        response = await client.post(
            "https://music.163.com/weapi/song/enhance/player/url/v1?csrf_token=",
            data=weapi(payload),
        )
        data = response.json().get("data") or []
    if not data or not data[0].get("url"):
        raise SourceError(
            "URL_UNAVAILABLE",
            f"《{track.name}》需要登录或 VIP 才能获取播放地址",
            "可在 .env 配置 NETEASE_COOKIE 后重试，或改用本地上传。",
        )
    item = data[0]
    track.stream_url = item["url"]
    track.ext = _ext_from_url(track.stream_url, item.get("type") or "mp3")
    track.bitrate = int(item.get("br") or 0) // 1000
    track.playable = True
    return track


async def resolve(source_input: str) -> ResolvedTrack:
    song_id = parse_link(source_input) or source_input.strip()
    if not song_id.isdigit():
        raise SourceError("INVALID_INPUT", "无法识别网易云歌曲 ID", "请粘贴 music.163.com 歌曲链接，或直接输入数字 ID")
    track = await detail(song_id)
    track = await resolve_stream(track)
    return track
