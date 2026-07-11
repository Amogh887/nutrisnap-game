import uuid
from urllib.parse import quote

from firebase_admin import storage


_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}


class FirebaseStoragePhotoStore:
    def __init__(self, bucket_name):
        self.bucket_name = bucket_name

    def _bucket(self):
        return storage.bucket(self.bucket_name)

    def save(self, circle_id, submission_id, data, content_type):
        ext = _EXTENSIONS.get(content_type, "jpg")
        object_path = f"circles/{circle_id}/{submission_id}.{ext}"
        blob = self._bucket().blob(object_path)
        token = str(uuid.uuid4())
        blob.metadata = {"firebaseStorageDownloadTokens": token}
        blob.upload_from_string(data, content_type=content_type)
        return object_path

    def url_for(self, object_path):
        if not object_path:
            return None
        blob = self._bucket().get_blob(object_path)
        if blob is None:
            return None
        token = (blob.metadata or {}).get("firebaseStorageDownloadTokens")
        if not token:
            return None
        encoded_path = quote(object_path, safe="")
        return (
            f"https://firebasestorage.googleapis.com/v0/b/{self.bucket_name}"
            f"/o/{encoded_path}?alt=media&token={token}"
        )
