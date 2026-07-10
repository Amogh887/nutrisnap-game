import hashlib
import json

from google.api_core.exceptions import AlreadyExists, PermissionDenied, ServiceUnavailable

from deps import require_user
from fakes import make_verdict

FIXED_UID = "test-uid-primary"

WEEK_MON = "2026-07-13T12:00:00+00:00"
WEEK_WED = "2026-07-15T12:00:00+00:00"
WEEK_FRI_BEFORE_CUTOFF = "2026-07-17T23:00:00+00:00"
WEEK_KEY = "2026-W29"
AFTER_CUTOFF = "2026-07-20T12:00:00+00:00"


def _set_uid(client, uid):
    client.app.dependency_overrides[require_user] = lambda: uid


def _circle_doc(fake_db, circle_id):
    return fake_db.store[("circles", circle_id)]


def _member_doc(fake_db, circle_id, uid):
    return fake_db.store.get(("circles", circle_id, "members", uid))


def _count_docs_in(fake_db, *prefix):
    return sum(
        1 for p in fake_db.store if p[: len(prefix)] == prefix and len(p) == len(prefix) + 1
    )


def create_circle(client, name="Test Circle", timezone="UTC"):
    resp = client.post("/api/circles", json={"name": name, "timezone": timezone})
    assert resp.status_code == 200, resp.text
    return resp.json()


def join_circle(client, invite_code):
    return client.post("/api/circles/join", json={"invite_code": invite_code})


def submit(
    client,
    circle_id,
    recipe_name="Soup",
    detected_ingredients="[]",
    image_bytes=b"fakejpegbytes",
    content_type="image/jpeg",
    filename="dish.jpg",
):
    recipe = {
        "name": recipe_name,
        "description": "desc",
        "ingredients_used": [],
        "instructions": "do it",
        "estimated_time_minutes": 30,
    }
    return client.post(
        f"/api/circles/{circle_id}/submissions",
        data={"recipe": json.dumps(recipe), "detected_ingredients": detected_ingredients},
        files={"image": (filename, image_bytes, content_type)},
    )


def test_create_circle_writes_circle_member_mirror_and_invite_code(client, fake_db):
    result = create_circle(client, name="Chef Squad")
    circle_id = result["id"]
    assert result["name"] == "Chef Squad"
    assert result["timezone"] == "UTC"
    assert len(result["invite_code"]) == 8

    circle = _circle_doc(fake_db, circle_id)
    assert circle["name"] == "Chef Squad"
    assert circle["created_by"] == FIXED_UID
    assert circle["member_count"] == 1
    assert circle["invite_code"] == result["invite_code"]

    member = _member_doc(fake_db, circle_id, FIXED_UID)
    assert member["role"] == "owner"
    assert member["active"] is True

    mirror = fake_db.store[("users", FIXED_UID, "circles", circle_id)]
    assert mirror["circle_id"] == circle_id

    invite_doc = fake_db.store[("invite_codes", result["invite_code"])]
    assert invite_doc["circle_id"] == circle_id


def test_create_circle_empty_name_returns_422(client):
    resp = client.post("/api/circles", json={"name": "   "})
    assert resp.status_code == 422


def test_create_circle_too_long_name_returns_422(client):
    resp = client.post("/api/circles", json={"name": "A" * 41})
    assert resp.status_code == 422


def test_create_circle_max_length_name_ok(client):
    resp = client.post("/api/circles", json={"name": "A" * 40})
    assert resp.status_code == 200


def test_create_circle_invalid_timezone_falls_back_to_utc(client):
    result = create_circle(client, timezone="Not/A_Real_Zone")
    assert result["timezone"] == "UTC"


def test_create_circle_invite_code_collision_retries(client, fake_db):
    invite_codes_ref = fake_db.collection("invite_codes")
    fake_db.force_conflict(invite_codes_ref, times=1)
    result = create_circle(client, name="Retry Circle")
    assert len(result["invite_code"]) == 8
    invite_doc = fake_db.store[("invite_codes", result["invite_code"])]
    assert invite_doc["circle_id"] == result["id"]


def test_list_circles_shows_role(client):
    circle = create_circle(client, name="Owned Circle")
    resp = client.get("/api/circles")
    assert resp.status_code == 200
    circles = resp.json()
    assert len(circles) == 1
    assert circles[0]["id"] == circle["id"]
    assert circles[0]["role"] == "owner"


def test_list_circles_member_role(client):
    circle = create_circle(client, name="Shared Circle")
    _set_uid(client, "second-user")
    join_circle(client, circle["invite_code"])
    resp = client.get("/api/circles")
    circles = resp.json()
    assert circles[0]["role"] == "member"


def test_join_circle_bad_code_returns_404(client):
    resp = join_circle(client, "BADCODE1")
    assert resp.status_code == 404


def test_join_circle_happy_path_increments_member_count(client, fake_db):
    circle = create_circle(client)
    _set_uid(client, "second-user")
    resp = join_circle(client, circle["invite_code"])
    assert resp.status_code == 200
    assert _circle_doc(fake_db, circle["id"])["member_count"] == 2
    member = _member_doc(fake_db, circle["id"], "second-user")
    assert member["active"] is True
    assert member["role"] == "member"


def test_join_circle_twice_is_idempotent(client, fake_db):
    circle = create_circle(client)
    _set_uid(client, "second-user")
    join_circle(client, circle["invite_code"])
    join_circle(client, circle["invite_code"])
    assert _circle_doc(fake_db, circle["id"])["member_count"] == 2


def test_rejoin_after_leave_reactivates(client, fake_db):
    circle = create_circle(client)
    _set_uid(client, "second-user")
    join_circle(client, circle["invite_code"])
    assert _circle_doc(fake_db, circle["id"])["member_count"] == 2

    leave_resp = client.post(f"/api/circles/{circle['id']}/leave")
    assert leave_resp.status_code == 200
    assert _circle_doc(fake_db, circle["id"])["member_count"] == 1
    assert _member_doc(fake_db, circle["id"], "second-user")["active"] is False

    rejoin_resp = join_circle(client, circle["invite_code"])
    assert rejoin_resp.status_code == 200
    assert _circle_doc(fake_db, circle["id"])["member_count"] == 2
    assert _member_doc(fake_db, circle["id"], "second-user")["active"] is True


def test_leave_circle_non_member_returns_403(client):
    circle = create_circle(client)
    _set_uid(client, "outsider")
    resp = client.post(f"/api/circles/{circle['id']}/leave")
    assert resp.status_code == 403


def test_leave_circle_response_shape(client):
    circle = create_circle(client)
    resp = client.post(f"/api/circles/{circle['id']}/leave")
    assert resp.status_code == 200
    assert resp.json() == {"id": circle["id"], "left": True}


def test_owner_leaving_transfers_to_earliest_joined_active_member(client, fake_db, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", "2026-07-15T10:00:00+00:00")
    circle = create_circle(client)

    monkeypatch.setenv("GAME_NOW_OVERRIDE", "2026-07-15T11:00:00+00:00")
    _set_uid(client, "later-user")
    join_circle(client, circle["invite_code"])

    monkeypatch.setenv("GAME_NOW_OVERRIDE", "2026-07-15T09:00:00+00:00")
    _set_uid(client, "earlier-user")
    join_circle(client, circle["invite_code"])

    _set_uid(client, FIXED_UID)
    resp = client.post(f"/api/circles/{circle['id']}/leave")
    assert resp.status_code == 200

    assert _member_doc(fake_db, circle["id"], "earlier-user")["role"] == "owner"
    assert _member_doc(fake_db, circle["id"], "later-user")["role"] == "member"


def test_get_circle_non_member_returns_403(client):
    circle = create_circle(client)
    _set_uid(client, "outsider")
    resp = client.get(f"/api/circles/{circle['id']}")
    assert resp.status_code == 403


def test_get_circle_returns_expected_fields(client):
    circle = create_circle(client)
    resp = client.get(f"/api/circles/{circle['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["week_key"]
    assert body["cutoff_utc"]
    assert len(body["members"]) == 1
    assert body["my_scored_today"] == 0
    assert body["my_attempts_today"] == 0


def test_submission_verified_scores_and_points_match_formula(client, fake_genai, monkeypatch):
    from game_logic import compute_points

    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict(difficulty=7, stretch=4))
    resp = submit(client, circle["id"], recipe_name="Verified Dish")
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["status"] == "scored"
    assert body["verified"] is True
    assert body["points"] == compute_points(7, 4)
    assert body["difficulty"] == 7
    assert body["stretch"] == 4


def test_submission_with_any_false_flag_is_rejected(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict(is_homemade=False))
    resp = submit(client, circle["id"], recipe_name="Not Homemade")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "rejected"
    assert body["verified"] is False
    assert body["points"] == 0


def test_submission_bad_recipe_json_returns_422(client, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    resp = client.post(
        f"/api/circles/{circle['id']}/submissions",
        data={"recipe": "{not valid json", "detected_ingredients": "[]"},
        files={"image": ("dish.jpg", b"bytes", "image/jpeg")},
    )
    assert resp.status_code == 422


def test_fourth_scored_submission_same_day_returns_429(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    for i in range(3):
        fake_genai.queue(make_verdict())
        resp = submit(
            client,
            circle["id"],
            recipe_name=f"Dish {i}",
            image_bytes=f"photo-{i}".encode(),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "scored"

    resp = submit(client, circle["id"], recipe_name="Dish 4", image_bytes=b"photo-4")
    assert resp.status_code == 429


def test_eleventh_attempt_same_day_returns_429(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    for i in range(10):
        fake_genai.queue(make_verdict(is_dish_match=False))
        resp = submit(
            client,
            circle["id"],
            recipe_name=f"Rejected {i}",
            image_bytes=f"attempt-{i}".encode(),
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "rejected"

    resp = submit(client, circle["id"], recipe_name="Attempt 11", image_bytes=b"attempt-10")
    assert resp.status_code == 429


def test_same_recipe_name_case_insensitive_scored_twice_returns_409(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict())
    resp1 = submit(client, circle["id"], recipe_name="Chicken Soup", image_bytes=b"photoA")
    assert resp1.status_code == 200
    assert resp1.json()["status"] == "scored"

    fake_genai.queue(make_verdict())
    resp2 = submit(client, circle["id"], recipe_name="CHICKEN soup", image_bytes=b"photoB")
    assert resp2.status_code == 409


def test_same_photo_bytes_twice_returns_409(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict())
    resp1 = submit(client, circle["id"], recipe_name="First Dish", image_bytes=b"same-bytes")
    assert resp1.status_code == 200

    resp2 = submit(client, circle["id"], recipe_name="Second Dish", image_bytes=b"same-bytes")
    assert resp2.status_code == 409


def test_genai_failing_twice_returns_502_and_no_submission_written(client, fake_genai, fake_db, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    before = _count_docs_in(fake_db, "circles", circle["id"], "submissions")

    fake_genai.queue(RuntimeError("boom1"))
    fake_genai.queue(RuntimeError("boom2"))
    resp = submit(client, circle["id"], recipe_name="Flaky Dish")
    assert resp.status_code == 502

    after = _count_docs_in(fake_db, "circles", circle["id"], "submissions")
    assert after == before


def test_genai_failing_once_then_succeeding_retries_successfully(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(RuntimeError("transient"))
    fake_genai.queue(make_verdict(difficulty=3, stretch=2))
    resp = submit(client, circle["id"], recipe_name="Resilient Dish")
    assert resp.status_code == 200
    assert resp.json()["status"] == "scored"
    assert fake_genai.call_count == 2


def test_photo_actually_written_to_disk(client, fake_genai, photo_store, tmp_path, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict())
    image_bytes = b"real-jpeg-bytes-content"
    resp = submit(client, circle["id"], recipe_name="Disk Dish", image_bytes=image_bytes)
    assert resp.status_code == 200
    submission_id = resp.json()["submission_id"]
    expected_path = tmp_path / "circles" / circle["id"] / f"{submission_id}.jpg"
    assert expected_path.exists()
    assert expected_path.read_bytes() == image_bytes


def test_leaderboard_default_week_before_cutoff_not_finalized(client, fake_genai, fake_db, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    resp = client.get(f"/api/circles/{circle['id']}/leaderboard")
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_finalized"] is False
    assert body["results"] is None
    assert ("circles", circle["id"], "weekly_results", body["week_key"]) not in fake_db.store


def test_leaderboard_bad_week_param_returns_422(client, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    resp = client.get(f"/api/circles/{circle['id']}/leaderboard?week=BAD")
    assert resp.status_code == 422


def test_leaderboard_enriches_standings_with_photo_url(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict())
    submit(client, circle["id"], recipe_name="Photo Dish", image_bytes=b"photo-check")

    resp = client.get(f"/api/circles/{circle['id']}/leaderboard")
    body = resp.json()
    entry = next(s for s in body["standings"] if s["uid"] == FIXED_UID)
    assert entry["submissions"]
    assert entry["submissions"][0]["photo_url"].startswith("/media/circles/")


def test_leaderboard_finalizes_on_read_past_cutoff_exactly_once(client, fake_genai, fake_db, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict(difficulty=8, stretch=6))
    submit(client, circle["id"], recipe_name="Winning Dish", image_bytes=b"winner-photo")

    monkeypatch.setenv("GAME_NOW_OVERRIDE", AFTER_CUTOFF)
    resp1 = client.get(f"/api/circles/{circle['id']}/leaderboard?week={WEEK_KEY}")
    assert resp1.status_code == 200
    body1 = resp1.json()
    assert body1["is_finalized"] is True
    assert body1["results"]["winner"]["uid"] == FIXED_UID
    assert len(body1["results"]["top_dishes"]) <= 3

    doc_count_after_first = _count_docs_in(fake_db, "circles", circle["id"], "weekly_results")
    assert doc_count_after_first == 1

    resp2 = client.get(f"/api/circles/{circle['id']}/leaderboard?week={WEEK_KEY}")
    assert resp2.status_code == 200
    assert resp2.json()["is_finalized"] is True

    doc_count_after_second = _count_docs_in(fake_db, "circles", circle["id"], "weekly_results")
    assert doc_count_after_second == 1


def test_leaderboard_finalize_survives_forced_concurrent_already_exists(client, fake_genai, fake_db, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict(difficulty=9, stretch=9))
    submit(client, circle["id"], recipe_name="Concurrent Dish", image_bytes=b"concurrent-photo")

    weekly_results_ref = fake_db.collection("circles").document(circle["id"]).collection("weekly_results")
    concurrent_doc = {
        "week_key": WEEK_KEY,
        "finalized_at": AFTER_CUTOFF,
        "winner": {"uid": FIXED_UID, "display_name": "Chef test-u", "total_points": 999},
        "standings": [],
        "top_dishes": [],
    }
    fake_db.force_conflict(weekly_results_ref, times=1, data=concurrent_doc)

    monkeypatch.setenv("GAME_NOW_OVERRIDE", AFTER_CUTOFF)
    resp = client.get(f"/api/circles/{circle['id']}/leaderboard?week={WEEK_KEY}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_finalized"] is True
    assert body["results"] is not None
    assert body["results"]["winner"]["total_points"] == 999

    doc_count = _count_docs_in(fake_db, "circles", circle["id"], "weekly_results")
    assert doc_count == 1


def test_results_pre_cutoff_returns_404(client, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    resp = client.get(f"/api/circles/{circle['id']}/results/{WEEK_KEY}")
    assert resp.status_code == 404


def test_results_post_cutoff_returns_finalized_doc(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict(difficulty=6, stretch=6))
    submit(client, circle["id"], recipe_name="Result Dish", image_bytes=b"result-photo")

    monkeypatch.setenv("GAME_NOW_OVERRIDE", AFTER_CUTOFF)
    resp = client.get(f"/api/circles/{circle['id']}/results/{WEEK_KEY}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["week_key"] == WEEK_KEY
    assert body["winner"]["uid"] == FIXED_UID


def test_results_winner_none_when_nobody_scored(client, fake_genai, monkeypatch):
    monkeypatch.setenv("GAME_NOW_OVERRIDE", WEEK_WED)
    circle = create_circle(client)
    fake_genai.queue(make_verdict(is_complete_dish=False))
    submit(client, circle["id"], recipe_name="Rejected Only", image_bytes=b"reject-photo")

    monkeypatch.setenv("GAME_NOW_OVERRIDE", AFTER_CUTOFF)
    resp = client.get(f"/api/circles/{circle['id']}/results/{WEEK_KEY}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["winner"] is None


def test_permission_denied_from_firestore_returns_503(client, fake_db):
    circle = create_circle(client)
    fake_db.fail_with(PermissionDenied("simulated outage"))
    resp = client.get(f"/api/circles/{circle['id']}")
    assert resp.status_code == 503


def test_service_unavailable_from_firestore_returns_503(client, fake_db):
    circle = create_circle(client)
    fake_db.fail_with(ServiceUnavailable("simulated outage"))
    resp = client.get(f"/api/circles/{circle['id']}")
    assert resp.status_code == 503
