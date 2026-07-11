from conftest import SERVER_DIR, API_DIR

FORBIDDEN_TOKENS = ["local_data", "LocalPhotoStore", "StaticFiles", "/media"]


def _all_server_source():
    files = list(SERVER_DIR.glob("*.py")) + [API_DIR / "index.py"]
    return {f: f.read_text() for f in files}


def test_no_local_data_filesystem_fallback_references():
    for path, content in _all_server_source().items():
        assert "local_data" not in content, f"found 'local_data' reference in {path}"


def test_no_local_photo_store_references():
    for path, content in _all_server_source().items():
        assert "LocalPhotoStore" not in content, f"found 'LocalPhotoStore' reference in {path}"


def test_no_static_files_mount_references():
    for path, content in _all_server_source().items():
        assert "StaticFiles" not in content, f"found 'StaticFiles' reference in {path}"


def test_no_media_mount_path_references():
    for path, content in _all_server_source().items():
        assert "/media" not in content, f"found '/media' reference in {path}"


def test_photo_store_module_only_defines_firebase_storage_photo_store():
    content = (SERVER_DIR / "photo_store.py").read_text()
    assert "FirebaseStoragePhotoStore" in content
    assert "class LocalPhotoStore" not in content
