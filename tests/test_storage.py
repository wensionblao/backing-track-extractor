from app.services.storage import sanitize, stem_filename, valid_job_id


def test_valid_job_id():
    assert valid_job_id("0123456789abcdef0123456789abcdef")
    assert not valid_job_id("0123456789ABCDEF0123456789ABCDEF")
    assert not valid_job_id("../etc/passwd")
    assert not valid_job_id("")


def test_sanitize_strips_path_characters():
    assert sanitize("a/b\\c:d*e?f\"g<h>i|j") == "a_b_c_d_e_f_g_h_i_j"
    assert sanitize("   空格   标题  ") == "空格 标题"
    assert sanitize("") == "track"


def test_stem_filename():
    name = stem_filename("歌手/名", "歌:名", "去和声伴奏", ".mp3")
    assert name == "歌手_名-歌_名-去和声伴奏.mp3"
