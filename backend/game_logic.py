import secrets
from datetime import datetime, date, time, timedelta, timezone
from zoneinfo import ZoneInfo


INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def generate_invite_code():
    return "".join(secrets.choice(INVITE_ALPHABET) for _ in range(8))


def week_key_for(now_utc, tz_name):
    local = now_utc.astimezone(ZoneInfo(tz_name))
    shifted = local.date() + timedelta(days=2)
    year, week, _ = shifted.isocalendar()
    return f"{year}-W{week:02d}"


def week_cutoff_utc(week_key, tz_name):
    year_part, week_part = week_key.split("-W")
    year = int(year_part)
    week = int(week_part)
    friday = date.fromisocalendar(year, week, 5)
    local_dt = datetime.combine(friday, time(23, 59, 59, 999999), ZoneInfo(tz_name))
    return local_dt.astimezone(timezone.utc)


def is_finalizable(week_key, tz_name, now_utc):
    return now_utc > week_cutoff_utc(week_key, tz_name)


def compute_points(difficulty, stretch):
    d = _clamp_int(difficulty)
    s = _clamp_int(stretch)
    return d * 10 + s * 6


def _clamp_int(value):
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = 1
    if n < 1:
        return 1
    if n > 10:
        return 10
    return n


def local_date(now_utc, tz_name):
    return now_utc.astimezone(ZoneInfo(tz_name)).date()


def count_today(submissions, uid, tz_name, now_utc, scored_only):
    tz = ZoneInfo(tz_name)
    today = now_utc.astimezone(tz).date()
    count = 0
    for submission in submissions:
        if submission.get("uid") != uid:
            continue
        if scored_only and submission.get("status") != "scored":
            continue
        created_at = submission.get("created_at")
        if not created_at:
            continue
        created_local = datetime.fromisoformat(created_at).astimezone(tz).date()
        if created_local == today:
            count += 1
    return count


def build_standings(submissions, members):
    member_by_uid = {}
    order = []
    for member in members:
        uid = member.get("uid")
        member_by_uid[uid] = member
        order.append(uid)

    scored_by_uid = {}
    for submission in submissions:
        if submission.get("status") != "scored":
            continue
        uid = submission.get("uid")
        scored_by_uid.setdefault(uid, []).append(submission)
        if uid not in member_by_uid:
            member_by_uid[uid] = {
                "uid": uid,
                "display_name": submission.get("display_name"),
                "active": False,
            }
            order.append(uid)

    standings = []
    for uid in order:
        member = member_by_uid[uid]
        scored = scored_by_uid.get(uid, [])
        total_points = sum(
            s.get("scores", {}).get("points", 0) for s in scored
        )
        earliest = None
        for s in scored:
            created_at = s.get("created_at")
            if created_at and (earliest is None or created_at < earliest):
                earliest = created_at
        standings.append({
            "uid": uid,
            "display_name": member.get("display_name"),
            "total_points": total_points,
            "submission_count": len(scored),
            "left_circle": not member.get("active", False),
            "_earliest": earliest,
        })

    def sort_key(entry):
        has_scores = entry["_earliest"] is not None
        return (
            0 if has_scores else 1,
            -entry["total_points"],
            entry["_earliest"] if has_scores else "",
            entry["display_name"] or "",
        )

    standings.sort(key=sort_key)
    for entry in standings:
        entry.pop("_earliest", None)
    return standings


def pick_top_dishes(submissions, n=3):
    scored = [s for s in submissions if s.get("status") == "scored"]
    scored.sort(key=lambda s: (-s.get("scores", {}).get("points", 0), s.get("created_at") or ""))
    top = []
    for s in scored[:n]:
        scores = s.get("scores", {})
        recipe = s.get("recipe", {})
        top.append({
            "submission_id": s.get("id"),
            "uid": s.get("uid"),
            "display_name": s.get("display_name"),
            "recipe_name": recipe.get("name"),
            "photo_path": s.get("photo_path"),
            "points": scores.get("points", 0),
            "difficulty": scores.get("difficulty"),
            "stretch": scores.get("stretch"),
        })
    return top
