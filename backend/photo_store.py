from pathlib import Path


_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class LocalPhotoStore:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)

    def save(self, circle_id, submission_id, data, content_type):
        ext = _EXTENSIONS.get(content_type, "jpg")
        relative = f"circles/{circle_id}/{submission_id}.{ext}"
        target = self.base_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return relative

    def url_for(self, path):
        return f"/media/{path}"
