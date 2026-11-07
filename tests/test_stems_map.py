from app.worker.stems_map import RECIPE_STEMS, classify, meta


def test_classify_inst_hq_outputs():
    files = [
        "storage/x/input_(Instrumental)_UVR-MDX-NET-Inst_HQ_3.wav",
        "storage/x/input_(Vocals)_UVR-MDX-NET-Inst_HQ_3.wav",
    ]
    result = classify(files)
    assert set(result) == {"instrumental", "vocals"}
    assert "Instrumental" in result["instrumental"]


def test_classify_karaoke_outputs():
    files = ["work/vocals_input_(Instrumental)_UVR_MDXNET_KARA_2.wav", "work/vocals_input_(Vocals)_UVR_MDXNET_KARA_2.wav"]
    result = classify(files)
    assert result["instrumental"].endswith("(Instrumental)_UVR_MDXNET_KARA_2.wav")
    assert result["vocals"].endswith("(Vocals)_UVR_MDXNET_KARA_2.wav")


def test_recipes_have_meta():
    for roles in RECIPE_STEMS.values():
        for role in roles:
            label, description = meta(role)
            assert label
            assert description
