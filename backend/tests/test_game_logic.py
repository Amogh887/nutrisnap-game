import random
import re
import string
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import pytest

from game_logic import (
    INVITE_ALPHABET,
    build_standings,
    compute_points,
    count_today,
    generate_invite_code,
    is_finalizable,
    pick_top_dishes,
    week_cutoff_utc,
    week_key_for,
)


def _expected_week_key(dt_utc, tz_name):
    local = dt_utc.astimezone(ZoneInfo(tz_name))
    shifted = local.date() + timedelta(days=2)
    year, week, _ = shifted.isocalendar()
    return f"{year}-W{week:02d}"


def test_generate_invite_code_length_and_alphabet():
    for _ in range(500):
        code = generate_invite_code()
        assert len(code) == 8
        assert all(ch in INVITE_ALPHABET for ch in code)


def test_generate_invite_code_excludes_ambiguous_characters():
    assert set(INVITE_ALPHABET) == set(string.ascii_uppercase + string.digits) - {
        "I", "O", "0", "1"
    }


def test_generate_invite_code_10k_no_invalid_chars_and_near_zero_collisions():
    codes = [generate_invite_code() for _ in range(10000)]
    assert all(len(c) == 8 for c in codes)
    assert all(all(ch in INVITE_ALPHABET for ch in c) for c in codes)
    unique = set(codes)
    duplicates = len(codes) - len(unique)
    assert duplicates <= 1


def test_week_key_for_format():
    now = datetime(2026, 7, 15, 12, 0, 0, tzinfo=timezone.utc)
    key = week_key_for(now, "UTC")
    assert re.match(r"^\d{4}-W\d{2}$", key)


def test_week_key_for_friday_vs_saturday_los_angeles():
    fri = datetime(2026, 7, 17, 23, 59, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    sat = datetime(2026, 7, 18, 0, 1, 0, tzinfo=ZoneInfo("America/Los_Angeles"))
    fri_utc = fri.astimezone(timezone.utc)
    sat_utc = sat.astimezone(timezone.utc)
    fri_key = week_key_for(fri_utc, "America/Los_Angeles")
    sat_key = week_key_for(sat_utc, "America/Los_Angeles")
    assert fri_key == "2026-W29"
    assert sat_key == "2026-W30"
    assert fri_key != sat_key


def test_week_key_for_friday_vs_saturday_kolkata():
    fri = datetime(2026, 7, 17, 23, 59, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    sat = datetime(2026, 7, 18, 0, 1, 0, tzinfo=ZoneInfo("Asia/Kolkata"))
    fri_utc = fri.astimezone(timezone.utc)
    sat_utc = sat.astimezone(timezone.utc)
    fri_key = week_key_for(fri_utc, "Asia/Kolkata")
    sat_key = week_key_for(sat_utc, "Asia/Kolkata")
    assert fri_key == "2026-W29"
    assert sat_key == "2026-W30"
    assert fri_key != sat_key


def test_week_key_for_same_utc_instant_differs_across_zones():
    instant = datetime(2026, 7, 17, 18, 30, 1, tzinfo=timezone.utc)
    la_key = week_key_for(instant, "America/Los_Angeles")
    kolkata_key = week_key_for(instant, "Asia/Kolkata")
    assert la_key == "2026-W29"
    assert kolkata_key == "2026-W30"
    assert la_key != kolkata_key


def test_week_key_for_year_boundary_2026_2027_utc():
    dec31 = datetime(2026, 12, 31, 12, 0, 0, tzinfo=timezone.utc)
    jan1 = datetime(2027, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    jan2 = datetime(2027, 1, 2, 12, 0, 0, tzinfo=timezone.utc)
    assert week_key_for(dec31, "UTC") == "2026-W53"
    assert week_key_for(jan1, "UTC") == "2026-W53"
    assert week_key_for(jan2, "UTC") == "2027-W01"


def test_week_key_for_dst_spring_forward_sunday_sanity():
    tz = "America/Los_Angeles"
    before = datetime(2027, 3, 13, 12, 0, 0, tzinfo=ZoneInfo(tz)).astimezone(timezone.utc)
    dst_day = datetime(2027, 3, 14, 12, 0, 0, tzinfo=ZoneInfo(tz)).astimezone(timezone.utc)
    after = datetime(2027, 3, 15, 12, 0, 0, tzinfo=ZoneInfo(tz)).astimezone(timezone.utc)
    for instant in (before, dst_day, after):
        key = week_key_for(instant, tz)
        assert re.match(r"^\d{4}-W\d{2}$", key)
        assert key == _expected_week_key(instant, tz)


def test_week_key_for_matches_independent_oracle_across_zones_and_random_instants():
    rng = random.Random(1234)
    zones = ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Europe/London", "Australia/Sydney"]
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for _ in range(300):
        offset_seconds = rng.randint(0, 3 * 365 * 24 * 3600)
        instant = base + timedelta(seconds=offset_seconds)
        tz = rng.choice(zones)
        assert week_key_for(instant, tz) == _expected_week_key(instant, tz)


def test_week_cutoff_utc_is_friday_end_of_day_local():
    cutoff = week_cutoff_utc("2026-W29", "America/Los_Angeles")
    local = cutoff.astimezone(ZoneInfo("America/Los_Angeles"))
    assert local.date() == date.fromisocalendar(2026, 29, 5)
    assert (local.hour, local.minute, local.second) == (23, 59, 59)
    assert local.microsecond == 999999


def test_week_cutoff_utc_round_trip_random_instants():
    rng = random.Random(99)
    zones = ["UTC", "America/Los_Angeles", "Asia/Kolkata", "Europe/London", "Australia/Sydney"]
    base = datetime(2026, 1, 1, tzinfo=timezone.utc)
    for _ in range(300):
        offset_seconds = rng.randint(0, 3 * 365 * 24 * 3600)
        instant = base + timedelta(seconds=offset_seconds)
        tz = rng.choice(zones)
        wk = week_key_for(instant, tz)
        cutoff = week_cutoff_utc(wk, tz)
        assert cutoff >= instant


def test_is_finalizable_flips_exactly_after_cutoff():
    wk = "2026-W29"
    tz = "America/Los_Angeles"
    cutoff = week_cutoff_utc(wk, tz)
    assert is_finalizable(wk, tz, cutoff) is False
    assert is_finalizable(wk, tz, cutoff - timedelta(microseconds=1)) is False
    assert is_finalizable(wk, tz, cutoff + timedelta(microseconds=1)) is True


def test_compute_points_clamps_low_and_high():
    assert compute_points(0, 0) == 16
    assert compute_points(-5, -100) == 16
    assert compute_points(11, 11) == 160
    assert compute_points(1000, 1000) == 160


def test_compute_points_formula_in_range():
    assert compute_points(5, 5) == 5 * 10 + 5 * 6
    assert compute_points(1, 10) == 1 * 10 + 10 * 6
    assert compute_points(10, 1) == 10 * 10 + 1 * 6


def test_compute_points_non_numeric_defaults_to_one():
    assert compute_points("bad", 5) == 1 * 10 + 5 * 6
    assert compute_points(None, None) == 16


def test_compute_points_monotone_in_both_args():
    for s in range(1, 11):
        prev = None
        for d in range(1, 11):
            pts = compute_points(d, s)
            if prev is not None:
                assert pts >= prev
            prev = pts
    for d in range(1, 11):
        prev = None
        for s in range(1, 11):
            pts = compute_points(d, s)
            if prev is not None:
                assert pts >= prev
            prev = pts


def test_compute_points_bounds_16_to_160():
    for d in range(-5, 20):
        for s in range(-5, 20):
            pts = compute_points(d, s)
            assert 16 <= pts <= 160


def test_count_today_straddles_local_midnight_los_angeles():
    now_utc_iso = "2026-07-18T06:30:00+00:00"
    now = datetime.fromisoformat(now_utc_iso)
    submissions = [
        {"uid": "u1", "status": "scored", "created_at": "2026-07-17T07:05:00+00:00"},
        {"uid": "u1", "status": "scored", "created_at": "2026-07-17T06:55:00+00:00"},
        {"uid": "u1", "status": "scored", "created_at": "2026-07-18T07:05:00+00:00"},
    ]
    count = count_today(submissions, "u1", "America/Los_Angeles", now, scored_only=False)
    assert count == 1


def test_count_today_filters_by_uid():
    now = datetime.fromisoformat("2026-07-18T06:30:00+00:00")
    submissions = [
        {"uid": "u1", "status": "scored", "created_at": "2026-07-17T07:05:00+00:00"},
        {"uid": "u2", "status": "scored", "created_at": "2026-07-17T07:05:00+00:00"},
    ]
    assert count_today(submissions, "u1", "America/Los_Angeles", now, scored_only=False) == 1
    assert count_today(submissions, "u2", "America/Los_Angeles", now, scored_only=False) == 1
    assert count_today(submissions, "u3", "America/Los_Angeles", now, scored_only=False) == 0


def test_count_today_scored_only_filters_status():
    now = datetime.fromisoformat("2026-07-18T06:30:00+00:00")
    submissions = [
        {"uid": "u1", "status": "scored", "created_at": "2026-07-17T07:05:00+00:00"},
        {"uid": "u1", "status": "rejected", "created_at": "2026-07-17T07:06:00+00:00"},
    ]
    assert count_today(submissions, "u1", "America/Los_Angeles", now, scored_only=False) == 2
    assert count_today(submissions, "u1", "America/Los_Angeles", now, scored_only=True) == 1


def test_count_today_ignores_missing_created_at():
    now = datetime.fromisoformat("2026-07-18T06:30:00+00:00")
    submissions = [{"uid": "u1", "status": "scored", "created_at": None}]
    assert count_today(submissions, "u1", "UTC", now, scored_only=False) == 0


def test_build_standings_sums_points_and_breaks_ties_by_earliest():
    members = [
        {"uid": "u1", "display_name": "Alice", "active": True},
        {"uid": "u2", "display_name": "Bob", "active": True},
    ]
    submissions = [
        {"uid": "u1", "status": "scored", "created_at": "2026-07-01T10:00:00+00:00",
         "scores": {"points": 50}},
        {"uid": "u1", "status": "scored", "created_at": "2026-07-02T10:00:00+00:00",
         "scores": {"points": 30}},
        {"uid": "u2", "status": "scored", "created_at": "2026-07-01T09:00:00+00:00",
         "scores": {"points": 80}},
        {"uid": "u1", "status": "rejected", "created_at": "2026-07-01T08:00:00+00:00",
         "scores": {"points": 0}},
    ]
    standings = build_standings(submissions, members)
    assert [s["uid"] for s in standings] == ["u2", "u1"]
    assert standings[0]["total_points"] == 80
    assert standings[1]["total_points"] == 80
    assert standings[1]["submission_count"] == 2


def test_build_standings_zero_submission_members_ranked_last_sorted_by_name():
    members = [
        {"uid": "u1", "display_name": "Zed", "active": True},
        {"uid": "u2", "display_name": "Amy", "active": True},
        {"uid": "u3", "display_name": "Carol", "active": False},
    ]
    submissions = [
        {"uid": "u1", "status": "scored", "created_at": "2026-07-01T10:00:00+00:00",
         "scores": {"points": 10}},
    ]
    standings = build_standings(submissions, members)
    assert standings[0]["uid"] == "u1"
    zero_scores = standings[1:]
    assert [s["uid"] for s in zero_scores] == ["u2", "u3"]
    assert all(s["total_points"] == 0 for s in zero_scores)


def test_build_standings_inactive_member_marked_left_circle():
    members = [{"uid": "u1", "display_name": "Alice", "active": False}]
    standings = build_standings([], members)
    assert standings[0]["left_circle"] is True


def test_build_standings_active_member_not_left_circle():
    members = [{"uid": "u1", "display_name": "Alice", "active": True}]
    standings = build_standings([], members)
    assert standings[0]["left_circle"] is False


def test_build_standings_uid_only_in_submissions_appears_left_circle():
    members = [{"uid": "u1", "display_name": "Alice", "active": True}]
    submissions = [
        {"uid": "u9", "display_name": "Ghost", "status": "scored",
         "created_at": "2026-07-01T10:00:00+00:00", "scores": {"points": 40}},
    ]
    standings = build_standings(submissions, members)
    ghost = next(s for s in standings if s["uid"] == "u9")
    assert ghost["left_circle"] is True
    assert ghost["total_points"] == 40


def test_pick_top_dishes_scored_only_sorted_and_limited():
    submissions = [
        {"id": "s1", "uid": "u1", "display_name": "Alice", "status": "scored",
         "created_at": "2026-07-01T10:00:00+00:00", "recipe": {"name": "Soup"},
         "photo_path": "p1", "scores": {"points": 50, "difficulty": 5, "stretch": 5}},
        {"id": "s2", "uid": "u2", "display_name": "Bob", "status": "rejected",
         "created_at": "2026-07-01T09:00:00+00:00", "recipe": {"name": "Bad"},
         "photo_path": "p2", "scores": {"points": 999, "difficulty": 9, "stretch": 9}},
        {"id": "s3", "uid": "u3", "display_name": "Carol", "status": "scored",
         "created_at": "2026-07-01T08:00:00+00:00", "recipe": {"name": "Stew"},
         "photo_path": "p3", "scores": {"points": 80, "difficulty": 8, "stretch": 4}},
        {"id": "s4", "uid": "u4", "display_name": "Dave", "status": "scored",
         "created_at": "2026-07-01T07:00:00+00:00", "recipe": {"name": "Pie"},
         "photo_path": "p4", "scores": {"points": 80, "difficulty": 7, "stretch": 5}},
        {"id": "s5", "uid": "u5", "display_name": "Eve", "status": "scored",
         "created_at": "2026-07-01T06:00:00+00:00", "recipe": {"name": "Cake"},
         "photo_path": "p5", "scores": {"points": 20, "difficulty": 2, "stretch": 2}},
    ]
    top = pick_top_dishes(submissions, n=3)
    assert [d["submission_id"] for d in top] == ["s4", "s3", "s1"]
    assert top[0]["recipe_name"] == "Pie"
    assert top[0]["photo_path"] == "p4"
    assert top[0]["difficulty"] == 7
    assert top[0]["stretch"] == 5
    assert top[0]["points"] == 80


def test_pick_top_dishes_respects_max_n():
    submissions = [
        {"id": f"s{i}", "uid": "u", "display_name": "A", "status": "scored",
         "created_at": f"2026-07-01T0{i}:00:00+00:00", "recipe": {"name": "X"},
         "photo_path": "p", "scores": {"points": i, "difficulty": 1, "stretch": 1}}
        for i in range(1, 6)
    ]
    top = pick_top_dishes(submissions, n=2)
    assert len(top) == 2
