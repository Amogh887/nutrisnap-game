import sys
import uuid

import pytest

from conftest import API_DIR

if str(API_DIR) not in sys.path:
    sys.path.insert(0, str(API_DIR))

from _server.photo_store import FirebaseStoragePhotoStore  # noqa: E402


class FakeBlob:
    def __init__(self, bucket, name):
        self.bucket = bucket
        self.name = name
        self.metadata = None
        self.uploaded_data = None
        self.uploaded_content_type = None
        self.upload_calls = 0

    def upload_from_string(self, data, content_type=None):
        self.upload_calls += 1
        self.uploaded_data = data
        self.uploaded_content_type = content_type
        self.bucket.blobs[self.name] = self


class FakeBucket:
    def __init__(self, name):
        self.name = name
        self.blobs = {}

    def blob(self, object_path):
        blob = self.blobs.get(object_path)
        if blob is None:
            blob = FakeBlob(self, object_path)
        return blob

    def get_blob(self, object_path):
        return self.blobs.get(object_path)


@pytest.fixture
def fake_bucket():
    return FakeBucket("dummy-project.firebasestorage.app")


@pytest.fixture
def store(fake_bucket, monkeypatch):
    photo_store = FirebaseStoragePhotoStore(fake_bucket.name)
    monkeypatch.setattr(photo_store, "_bucket", lambda: fake_bucket)
    return photo_store


def test_save_uploads_to_expected_object_path_for_jpeg(store, fake_bucket):
    object_path = store.save("circle1", "sub1", b"jpegdata", "image/jpeg")
    assert object_path == "circles/circle1/sub1.jpg"
    assert object_path in fake_bucket.blobs
    blob = fake_bucket.blobs[object_path]
    assert blob.uploaded_data == b"jpegdata"
    assert blob.uploaded_content_type == "image/jpeg"
    assert blob.upload_calls == 1


def test_save_uploads_to_expected_object_path_for_png(store, fake_bucket):
    object_path = store.save("c1", "s1", b"pngdata", "image/png")
    assert object_path == "circles/c1/s1.png"
    assert fake_bucket.blobs[object_path].uploaded_content_type == "image/png"


def test_save_uploads_to_expected_object_path_for_webp(store, fake_bucket):
    object_path = store.save("c1", "s1", b"webpdata", "image/webp")
    assert object_path == "circles/c1/s1.webp"


def test_save_unknown_content_type_defaults_extension_to_jpg(store, fake_bucket):
    object_path = store.save("c1", "s1", b"data", "application/octet-stream")
    assert object_path == "circles/c1/s1.jpg"


def test_save_missing_content_type_defaults_extension_to_jpg(store, fake_bucket):
    object_path = store.save("c1", "s1", b"data", None)
    assert object_path == "circles/c1/s1.jpg"


def test_save_sets_download_token_metadata_as_valid_uuid(store, fake_bucket):
    object_path = store.save("circle1", "sub1", b"data", "image/jpeg")
    blob = fake_bucket.blobs[object_path]
    assert blob.metadata is not None
    token = blob.metadata.get("firebaseStorageDownloadTokens")
    assert token is not None
    uuid.UUID(token)


def test_save_returns_object_path_not_a_url(store):
    object_path = store.save("circle1", "sub1", b"data", "image/jpeg")
    assert not object_path.startswith("http")
    assert object_path == "circles/circle1/sub1.jpg"


def test_url_for_returns_none_for_falsy_path(store):
    assert store.url_for(None) is None
    assert store.url_for("") is None


def test_url_for_returns_none_when_blob_missing(store):
    assert store.url_for("circles/nope/nope.jpg") is None


def test_url_for_returns_none_when_token_missing(store, fake_bucket):
    blob = fake_bucket.blob("circles/c1/s1.jpg")
    blob.metadata = {}
    fake_bucket.blobs["circles/c1/s1.jpg"] = blob
    assert store.url_for("circles/c1/s1.jpg") is None


def test_url_for_builds_expected_absolute_url_shape(store, fake_bucket):
    object_path = store.save("circle1", "sub1", b"data", "image/jpeg")
    url = store.url_for(object_path)
    assert url is not None
    assert url.startswith("https://firebasestorage.googleapis.com/v0/b/")
    assert "/o/circles%2Fcircle1%2Fsub1.jpg?alt=media&token=" in url
    assert url.startswith(f"https://firebasestorage.googleapis.com/v0/b/{fake_bucket.name}/o/")


def test_url_for_percent_encodes_slashes_as_a_single_segment(store):
    object_path = store.save("circle-with/slash-ish-id", "sub1", b"data", "image/jpeg")
    url = store.url_for(object_path)
    encoded = url.split("/o/")[1].split("?")[0]
    assert "/" not in encoded
    assert "%2F" in encoded


def test_save_then_url_for_round_trip_token_is_consistent(store, fake_bucket):
    object_path = store.save("circle1", "sub1", b"data", "image/jpeg")
    saved_token = fake_bucket.blobs[object_path].metadata["firebaseStorageDownloadTokens"]
    url = store.url_for(object_path)
    assert f"token={saved_token}" in url


def test_url_for_result_is_absolute_https_url(store):
    object_path = store.save("circle1", "sub1", b"data", "image/jpeg")
    url = store.url_for(object_path)
    assert url.startswith("https://")


def test_save_and_url_for_different_content_types_all_round_trip(store, fake_bucket):
    for content_type, ext in (("image/jpeg", "jpg"), ("image/png", "png"), ("image/webp", "webp")):
        object_path = store.save("circleX", f"sub-{ext}", b"bytes", content_type)
        assert object_path == f"circles/circleX/sub-{ext}.{ext}"
        url = store.url_for(object_path)
        assert url is not None
        assert f"sub-{ext}.{ext}" in url


def test_bucket_name_is_used_verbatim_in_url(monkeypatch):
    fake_bucket = FakeBucket("some-other-bucket-name.firebasestorage.app")
    photo_store = FirebaseStoragePhotoStore(fake_bucket.name)
    monkeypatch.setattr(photo_store, "_bucket", lambda: fake_bucket)
    object_path = photo_store.save("c1", "s1", b"x", "image/jpeg")
    url = photo_store.url_for(object_path)
    assert "some-other-bucket-name.firebasestorage.app" in url


def test_bucket_uses_firebase_admin_storage_bucket_by_default(monkeypatch):
    from firebase_admin import storage as fa_storage

    captured = {}

    def fake_storage_bucket(name):
        captured["name"] = name
        return FakeBucket(name)

    monkeypatch.setattr(fa_storage, "bucket", fake_storage_bucket)
    photo_store = FirebaseStoragePhotoStore("real-bucket-name")
    bucket = photo_store._bucket()
    assert captured["name"] == "real-bucket-name"
    assert bucket.name == "real-bucket-name"
