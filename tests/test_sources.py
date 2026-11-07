from app.services.sources import netease, qq
from app.services.sources.registry import detect_source


def test_netease_parse_link_variants():
    assert netease.parse_link("https://music.163.com/song?id=123456") == "123456"
    assert netease.parse_link("https://music.163.com/#/song?id=98765") == "98765"
    assert netease.parse_link("music.163.com/song?id=555") == "555"
    assert netease.parse_link("https://y.qq.com/n/ryqq/songDetail/abc") is None


def test_qq_parse_link_variants():
    assert qq.parse_link("https://y.qq.com/n/ryqq/songDetail/001abcXYZ") == ("mid", "001abcXYZ")
    assert qq.parse_link("https://y.qq.com/song/002DEF") == ("mid", "002DEF")
    assert qq.parse_link("songmid=003GHI789") == ("mid", "003GHI789")
    assert qq.parse_link("123456789") == ("songid", "123456789")
    assert qq.parse_link("https://music.163.com/song?id=123") is None


def test_detect_source():
    assert detect_source("https://music.163.com/song?id=1") == "netease"
    assert detect_source("https://y.qq.com/n/ryqq/songDetail/abc") == "qq"
    assert detect_source("随便一段文字") is None
