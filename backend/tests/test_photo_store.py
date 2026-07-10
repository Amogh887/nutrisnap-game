from photo_store import LocalPhotoStore


def test_save_writes_jpeg_under_expected_path(tmp_path):
    store = LocalPhotoStore(tmp_path)
    path = store.save("circle1", "sub1", b"jpegdata", "image/jpeg")
    assert path == "circles/circle1/sub1.jpg"
    target = tmp_path / "circles" / "circle1" / "sub1.jpg"
    assert target.exists()
    assert target.read_bytes() == b"jpegdata"


def test_save_writes_png_extension(tmp_path):
    store = LocalPhotoStore(tmp_path)
    path = store.save("c1", "s1", b"pngdata", "image/png")
    assert path == "circles/c1/s1.png"
    assert (tmp_path / "circles" / "c1" / "s1.png").read_bytes() == b"pngdata"


def test_save_writes_webp_extension(tmp_path):
    store = LocalPhotoStore(tmp_path)
    path = store.save("c1", "s1", b"webpdata", "image/webp")
    assert path == "circles/c1/s1.webp"


def test_save_unknown_content_type_defaults_to_jpg(tmp_path):
    store = LocalPhotoStore(tmp_path)
    path = store.save("c1", "s1", b"data", "application/octet-stream")
    assert path == "circles/c1/s1.jpg"


def test_save_missing_content_type_defaults_to_jpg(tmp_path):
    store = LocalPhotoStore(tmp_path)
    path = store.save("c1", "s1", b"data", None)
    assert path == "circles/c1/s1.jpg"


def test_save_creates_intermediate_directories(tmp_path):
    store = LocalPhotoStore(tmp_path / "nested" / "base")
    path = store.save("c9", "s9", b"x", "image/jpeg")
    assert (tmp_path / "nested" / "base" / "circles" / "c9" / "s9.jpg").exists()
    assert path == "circles/c9/s9.jpg"


def test_url_for_prefixes_media():
    store = LocalPhotoStore("/irrelevant")
    assert store.url_for("circles/c1/s1.jpg") == "/media/circles/c1/s1.jpg"
