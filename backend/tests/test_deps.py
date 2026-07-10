import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import deps
from fakes import FakeDb


def test_default_preferences_has_expected_keys():
    expected_keys = {
        "health_goal",
        "diet_type",
        "allergies",
        "cooking_time",
        "cuisine_preferences",
        "calorie_target",
        "fitness_goal",
    }
    assert set(deps.DEFAULT_PREFERENCES.keys()) == expected_keys


def test_get_current_user_returns_none_without_credentials():
    assert deps.get_current_user(None) is None


def test_get_current_user_returns_uid_on_valid_token(monkeypatch):
    monkeypatch.setattr(deps.auth, "verify_id_token", lambda token: {"uid": "abc123"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="tok")
    assert deps.get_current_user(creds) == "abc123"


def test_get_current_user_returns_none_on_verification_error(monkeypatch):
    def raise_error(token):
        raise ValueError("invalid token")

    monkeypatch.setattr(deps.auth, "verify_id_token", raise_error)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad")
    assert deps.get_current_user(creds) is None


def test_require_user_raises_401_without_credentials():
    with pytest.raises(HTTPException) as exc_info:
        deps.require_user(None)
    assert exc_info.value.status_code == 401


def test_require_user_raises_401_on_invalid_token(monkeypatch):
    def raise_error(token):
        raise ValueError("invalid token")

    monkeypatch.setattr(deps.auth, "verify_id_token", raise_error)
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad")
    with pytest.raises(HTTPException) as exc_info:
        deps.require_user(creds)
    assert exc_info.value.status_code == 401


def test_require_user_returns_uid_on_valid_token(monkeypatch):
    monkeypatch.setattr(deps.auth, "verify_id_token", lambda token: {"uid": "xyz789"})
    creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="tok")
    assert deps.require_user(creds) == "xyz789"


def test_get_user_preferences_none_uid_returns_defaults():
    db = FakeDb()
    assert deps.get_user_preferences(db, None) == deps.DEFAULT_PREFERENCES


def test_get_user_preferences_missing_doc_returns_defaults():
    db = FakeDb()
    assert deps.get_user_preferences(db, "u1") == deps.DEFAULT_PREFERENCES


def test_get_user_preferences_merges_partial_with_defaults():
    db = FakeDb()
    db.collection("users").document("u1").set({"preferences": {"diet_type": "vegan"}})
    prefs = deps.get_user_preferences(db, "u1")
    assert prefs["diet_type"] == "vegan"
    assert prefs["health_goal"] == deps.DEFAULT_PREFERENCES["health_goal"]
    assert prefs["allergies"] == deps.DEFAULT_PREFERENCES["allergies"]


def test_get_user_preferences_swallows_exceptions():
    db = FakeDb()
    db.fail_with(RuntimeError("firestore down"))
    assert deps.get_user_preferences(db, "u1") == deps.DEFAULT_PREFERENCES
