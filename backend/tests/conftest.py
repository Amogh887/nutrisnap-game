import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import game
from deps import require_user
from photo_store import LocalPhotoStore

from fakes import FakeDb, FakeGenaiClient

FIXED_UID = "test-uid-primary"


@pytest.fixture
def fake_db():
    return FakeDb()


@pytest.fixture
def fake_genai():
    return FakeGenaiClient()


@pytest.fixture
def photo_store(tmp_path):
    return LocalPhotoStore(tmp_path)


@pytest.fixture
def app(fake_db, fake_genai, photo_store):
    application = FastAPI()
    application.include_router(game.router)
    application.dependency_overrides[require_user] = lambda: FIXED_UID
    game.init_game(fake_db, fake_genai, photo_store)
    yield application
    application.dependency_overrides.clear()


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture(autouse=True)
def _clear_game_now_override(monkeypatch):
    monkeypatch.delenv("GAME_NOW_OVERRIDE", raising=False)
    yield
    monkeypatch.delenv("GAME_NOW_OVERRIDE", raising=False)


def set_uid(app, uid):
    app.dependency_overrides[require_user] = lambda: uid
