import os
import re
import json
import hashlib
from functools import wraps
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from google.genai import types
from google.cloud.firestore import Increment
from google.api_core.exceptions import (
    AlreadyExists,
    PermissionDenied as GooglePermissionDenied,
    ServiceUnavailable as GoogleServiceUnavailable,
)

from deps import require_user, get_user_preferences
from game_logic import (
    generate_invite_code,
    week_key_for,
    week_cutoff_utc,
    is_finalizable,
    compute_points,
    count_today,
    build_standings,
    pick_top_dishes,
)


router = APIRouter(prefix="/api")

_deps = {}


def init_game(db, genai_client, photo_store):
    _deps["db"] = db
    _deps["client"] = genai_client
    _deps["photos"] = photo_store


def _db():
    return _deps["db"]


def _client():
    return _deps["client"]


def _photos():
    return _deps["photos"]


def now_utc():
    override = os.environ.get("GAME_NOW_OVERRIDE")
    if override:
        parsed = datetime.fromisoformat(override)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    return datetime.now(timezone.utc)


def _guard_firestore(func):
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            return await func(*args, **kwargs)
        except (GooglePermissionDenied, GoogleServiceUnavailable):
            raise HTTPException(status_code=503, detail="Firestore unavailable")
    return wrapper


def _clamp_score(value):
    try:
        n = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, min(10, n))


def _member_identity(uid):
    doc = _db().collection("users").document(uid).get()
    display_name = None
    photo_url = None
    if doc.exists:
        data = doc.to_dict() or {}
        profile = data.get("profile") or {}
        display_name = profile.get("display_name")
        photo_url = profile.get("photo_url")
    if not display_name:
        display_name = "Chef " + uid[:6]
    return display_name, photo_url


def _require_active_member(circle_ref, uid):
    circle_doc = circle_ref.get()
    if not circle_doc.exists:
        raise HTTPException(status_code=404, detail="Circle not found")
    member_doc = circle_ref.collection("members").document(uid).get()
    if not member_doc.exists or not (member_doc.to_dict() or {}).get("active"):
        raise HTTPException(status_code=403, detail="Not an active member")
    return circle_doc.to_dict() or {}, member_doc


def _require_member(circle_ref, uid):
    circle_doc = circle_ref.get()
    if not circle_doc.exists:
        raise HTTPException(status_code=404, detail="Circle not found")
    member_doc = circle_ref.collection("members").document(uid).get()
    if not member_doc.exists:
        raise HTTPException(status_code=403, detail="Not a member")
    return circle_doc.to_dict() or {}, member_doc


def _week_submissions(circle_ref, week_key):
    return [
        {"id": s.id, **(s.to_dict() or {})}
        for s in circle_ref.collection("submissions").where("week_key", "==", week_key).stream()
    ]


class CreateCircleBody(BaseModel):
    name: str
    timezone: str | None = None


class JoinCircleBody(BaseModel):
    invite_code: str


@router.post("/circles")
@_guard_firestore
async def create_circle(body: CreateCircleBody, uid: str = Depends(require_user)):
    name = (body.name or "").strip()
    if not name or len(name) > 40:
        raise HTTPException(status_code=422, detail="Circle name must be 1-40 characters")

    tz_name = body.timezone or "UTC"
    try:
        ZoneInfo(tz_name)
    except Exception:
        tz_name = "UTC"

    db = _db()
    circle_ref = db.collection("circles").document()
    circle_id = circle_ref.id

    code = None
    for _ in range(5):
        candidate = generate_invite_code()
        try:
            db.collection("invite_codes").document(candidate).create({"circle_id": circle_id})
            code = candidate
            break
        except AlreadyExists:
            continue
    if code is None:
        raise HTTPException(status_code=503, detail="Could not allocate invite code")

    created_at = now_utc().isoformat()
    display_name, photo_url = _member_identity(uid)

    batch = db.batch()
    batch.set(circle_ref, {
        "name": name,
        "created_by": uid,
        "created_at": created_at,
        "invite_code": code,
        "timezone": tz_name,
        "member_count": 1,
    })
    batch.set(circle_ref.collection("members").document(uid), {
        "uid": uid,
        "display_name": display_name,
        "photo_url": photo_url,
        "joined_at": created_at,
        "role": "owner",
        "active": True,
    })
    batch.set(db.collection("users").document(uid).collection("circles").document(circle_id), {
        "circle_id": circle_id,
        "name": name,
        "joined_at": created_at,
    })
    batch.commit()

    return {"id": circle_id, "name": name, "invite_code": code, "timezone": tz_name}


@router.get("/circles")
@_guard_firestore
async def list_circles(uid: str = Depends(require_user)):
    db = _db()
    mirrors = db.collection("users").document(uid).collection("circles").stream()
    result = []
    for mirror in mirrors:
        data = mirror.to_dict() or {}
        circle_id = data.get("circle_id") or mirror.id
        circle_ref = db.collection("circles").document(circle_id)
        circle_doc = circle_ref.get()
        if not circle_doc.exists:
            continue
        circle = circle_doc.to_dict() or {}
        member_doc = circle_ref.collection("members").document(uid).get()
        role = (member_doc.to_dict() or {}).get("role") if member_doc.exists else None
        result.append({
            "id": circle_id,
            "name": circle.get("name"),
            "invite_code": circle.get("invite_code"),
            "timezone": circle.get("timezone"),
            "member_count": circle.get("member_count"),
            "role": role,
        })
    return result


@router.post("/circles/join")
@_guard_firestore
async def join_circle(body: JoinCircleBody, uid: str = Depends(require_user)):
    code = (body.invite_code or "").strip().upper()
    db = _db()
    invite_doc = db.collection("invite_codes").document(code).get()
    if not invite_doc.exists:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    circle_id = (invite_doc.to_dict() or {}).get("circle_id")

    circle_ref = db.collection("circles").document(circle_id)
    circle_doc = circle_ref.get()
    if not circle_doc.exists:
        raise HTTPException(status_code=404, detail="Invalid invite code")
    name = (circle_doc.to_dict() or {}).get("name")

    member_ref = circle_ref.collection("members").document(uid)
    member_doc = member_ref.get()
    now_iso = now_utc().isoformat()
    mirror_ref = db.collection("users").document(uid).collection("circles").document(circle_id)

    if member_doc.exists:
        member = member_doc.to_dict() or {}
        if member.get("active"):
            return {"id": circle_id, "name": name}
        member_ref.update({"active": True})
        mirror_ref.set({"circle_id": circle_id, "name": name, "joined_at": now_iso})
        circle_ref.update({"member_count": Increment(1)})
        return {"id": circle_id, "name": name}

    display_name, photo_url = _member_identity(uid)
    member_ref.set({
        "uid": uid,
        "display_name": display_name,
        "photo_url": photo_url,
        "joined_at": now_iso,
        "role": "member",
        "active": True,
    })
    mirror_ref.set({"circle_id": circle_id, "name": name, "joined_at": now_iso})
    circle_ref.update({"member_count": Increment(1)})
    return {"id": circle_id, "name": name}


@router.post("/circles/{circle_id}/leave")
@_guard_firestore
async def leave_circle(circle_id: str, uid: str = Depends(require_user)):
    db = _db()
    circle_ref = db.collection("circles").document(circle_id)
    member_ref = circle_ref.collection("members").document(uid)
    member_doc = member_ref.get()
    if not member_doc.exists or not (member_doc.to_dict() or {}).get("active"):
        raise HTTPException(status_code=403, detail="Not an active member")

    was_owner = (member_doc.to_dict() or {}).get("role") == "owner"
    updates = {"active": False}
    if was_owner:
        updates["role"] = "member"
    member_ref.update(updates)

    db.collection("users").document(uid).collection("circles").document(circle_id).delete()
    circle_ref.update({"member_count": Increment(-1)})

    if was_owner:
        remaining = [
            (m.id, m.to_dict() or {})
            for m in circle_ref.collection("members").where("active", "==", True).stream()
            if m.id != uid
        ]
        if remaining:
            remaining.sort(key=lambda item: (item[1].get("joined_at") or ""))
            circle_ref.collection("members").document(remaining[0][0]).update({"role": "owner"})

    return {"id": circle_id, "left": True}


@router.get("/circles/{circle_id}")
@_guard_firestore
async def get_circle(circle_id: str, uid: str = Depends(require_user)):
    db = _db()
    circle_ref = db.collection("circles").document(circle_id)
    circle, _ = _require_active_member(circle_ref, uid)

    tz_name = circle.get("timezone") or "UTC"
    now = now_utc()
    wk = week_key_for(now, tz_name)
    cutoff = week_cutoff_utc(wk, tz_name)

    members = []
    for m in circle_ref.collection("members").where("active", "==", True).stream():
        data = m.to_dict() or {}
        members.append({
            "uid": data.get("uid"),
            "display_name": data.get("display_name"),
            "photo_url": data.get("photo_url"),
            "role": data.get("role"),
            "active": data.get("active"),
            "joined_at": data.get("joined_at"),
        })

    submissions = _week_submissions(circle_ref, wk)

    return {
        "id": circle_id,
        "name": circle.get("name"),
        "invite_code": circle.get("invite_code"),
        "timezone": tz_name,
        "week_key": wk,
        "cutoff_utc": cutoff.isoformat(),
        "members": members,
        "my_scored_today": count_today(submissions, uid, tz_name, now, True),
        "my_attempts_today": count_today(submissions, uid, tz_name, now, False),
    }


_VERIFICATION_SCHEMA = types.Schema(
    type=types.Type.OBJECT,
    properties={
        "is_dish_match": types.Schema(type=types.Type.BOOLEAN),
        "is_homemade": types.Schema(type=types.Type.BOOLEAN),
        "is_complete_dish": types.Schema(type=types.Type.BOOLEAN),
        "confidence": types.Schema(type=types.Type.NUMBER),
        "reasons": types.Schema(type=types.Type.ARRAY, items=types.Schema(type=types.Type.STRING)),
        "difficulty": types.Schema(type=types.Type.INTEGER),
        "stretch": types.Schema(type=types.Type.INTEGER),
        "feedback": types.Schema(type=types.Type.STRING),
    },
    required=[
        "is_dish_match",
        "is_homemade",
        "is_complete_dish",
        "confidence",
        "reasons",
        "difficulty",
        "stretch",
        "feedback",
    ],
)


def build_verification_prompt(recipe, detected_ingredients, prefs):
    ease_of_cooking = prefs.get("ease_of_cooking", "not specified")
    cuisine_preferences = prefs.get("cuisine_preferences", "any")
    cost_preference = prefs.get("cost_preference", "not specified")
    spice_level = prefs.get("spice_level", "not specified")
    cooking_time = prefs.get("cooking_time", "moderate")

    recipe_summary = {
        "name": recipe.get("name"),
        "description": recipe.get("description"),
        "ingredients_used": recipe.get("ingredients_used"),
        "instructions": recipe.get("instructions"),
        "estimated_time_minutes": recipe.get("estimated_time_minutes"),
    }

    return f"""You are the judge for NutriSnap, a friendly home-cooking competition.
A cook photographed a dish they claim to have made from this recipe. Analyze the attached photo against the recipe and the cook's profile, then return a strict JSON verdict.

RECIPE:
{json.dumps(recipe_summary, ensure_ascii=False, indent=2)}

ORIGINALLY DETECTED INGREDIENTS:
{json.dumps(detected_ingredients, ensure_ascii=False)}

COOK PROFILE:
- ease_of_cooking (self-rated skill/comfort): {ease_of_cooking}
- cuisine_preferences (familiar/favorite cuisines): {cuisine_preferences}
- cost_preference: {cost_preference}
- spice_level: {spice_level}
- cooking_time preference: {cooking_time}

EVALUATE:
- is_dish_match: Is the photo plausibly the named recipe with its key components visible? Tolerate normal home-cook variation in plating and portions.
- is_homemade: Does it look genuinely home-made (home plating, ordinary cookware, home lighting)? Set false for restaurant-style plating, stock-photo perfection, watermarks, or a photo of a screen/screenshot.
- is_complete_dish: Is it a finished, plated dish rather than raw ingredients or a mid-cook shot?
- difficulty (1-10): Objective difficulty of the recipe based on techniques, timing sensitivity, and coordinating multiple components.
- stretch (1-10): How far this dish sits outside THIS cook's comfort zone given their profile — skill gap vs ease_of_cooking, unfamiliar cuisine vs cuisine_preferences, spice vs spice_level, time vs cooking_time, cost vs cost_preference. An advanced cook making a staple of their favorite cuisine is 1-2; a beginner attempting fresh pasta is 8+.
- reasons: Short strings explaining the verification verdicts.
- feedback: 1-2 encouraging, specific sentences for the cook.
- confidence: 0-1 overall confidence in this verdict.

Return only the JSON object matching the required schema."""


def _run_verification(recipe, detected_ingredients, prefs, image_bytes, content_type):
    prompt = build_verification_prompt(recipe, detected_ingredients, prefs)
    for _ in range(2):
        try:
            response = _client().models.generate_content(
                model="gemini-2.5-flash",
                contents=[
                    types.Part.from_bytes(data=image_bytes, mime_type=content_type),
                    prompt,
                ],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=_VERIFICATION_SCHEMA,
                ),
            )
            return json.loads(response.text)
        except Exception:
            continue
    raise HTTPException(status_code=502, detail="Verification service unavailable, attempt not counted")


@router.post("/circles/{circle_id}/submissions")
@_guard_firestore
async def create_submission(
    circle_id: str,
    recipe: str = Form(...),
    detected_ingredients: str = Form("[]"),
    image: UploadFile = File(...),
    uid: str = Depends(require_user),
):
    db = _db()
    circle_ref = db.collection("circles").document(circle_id)
    circle, _ = _require_active_member(circle_ref, uid)

    try:
        recipe_data = json.loads(recipe)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Invalid recipe JSON")
    if not isinstance(recipe_data, dict) or not recipe_data.get("name"):
        raise HTTPException(status_code=422, detail="Recipe name is required")

    try:
        ingredients_data = json.loads(detected_ingredients)
    except (ValueError, TypeError):
        raise HTTPException(status_code=422, detail="Invalid detected_ingredients JSON")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=422, detail="Image is required")
    content_type = image.content_type or "image/jpeg"
    photo_sha256 = hashlib.sha256(image_bytes).hexdigest()

    tz_name = circle.get("timezone") or "UTC"
    now = now_utc()
    wk = week_key_for(now, tz_name)
    submissions = _week_submissions(circle_ref, wk)

    if count_today(submissions, uid, tz_name, now, False) >= 10:
        raise HTTPException(status_code=429, detail="Daily attempt limit reached")
    if count_today(submissions, uid, tz_name, now, True) >= 3:
        raise HTTPException(status_code=429, detail="Daily scored-dish limit reached (3). Back tomorrow, chef!")

    recipe_name_key = str(recipe_data.get("name")).strip().lower()
    for s in submissions:
        if s.get("uid") == uid and s.get("status") == "scored":
            existing_name = str((s.get("recipe") or {}).get("name") or "").strip().lower()
            if existing_name == recipe_name_key:
                raise HTTPException(status_code=409, detail="You already scored this recipe this week")
    for s in submissions:
        if s.get("photo_sha256") == photo_sha256:
            raise HTTPException(status_code=409, detail="This photo was already submitted this week")

    prefs = get_user_preferences(db, uid)
    verification = _run_verification(recipe_data, ingredients_data, prefs, image_bytes, content_type)

    is_dish_match = bool(verification.get("is_dish_match"))
    is_homemade = bool(verification.get("is_homemade"))
    is_complete_dish = bool(verification.get("is_complete_dish"))
    verified = is_dish_match and is_homemade and is_complete_dish

    difficulty = _clamp_score(verification.get("difficulty"))
    stretch = _clamp_score(verification.get("stretch"))
    points = compute_points(difficulty, stretch) if verified else 0
    status = "scored" if verified else "rejected"

    display_name, _ = _member_identity(uid)

    submission_ref = circle_ref.collection("submissions").document()
    submission_id = submission_ref.id
    photo_path = _photos().save(circle_id, submission_id, image_bytes, content_type)

    submission_ref.set({
        "uid": uid,
        "display_name": display_name,
        "week_key": wk,
        "created_at": now.isoformat(),
        "recipe": {
            "name": recipe_data.get("name"),
            "description": recipe_data.get("description"),
            "ingredients_used": recipe_data.get("ingredients_used"),
            "instructions": recipe_data.get("instructions"),
            "estimated_time_minutes": recipe_data.get("estimated_time_minutes"),
        },
        "detected_ingredients": ingredients_data,
        "photo_path": photo_path,
        "photo_sha256": photo_sha256,
        "verification": {
            "is_dish_match": is_dish_match,
            "is_homemade": is_homemade,
            "is_complete_dish": is_complete_dish,
            "verified": verified,
            "confidence": verification.get("confidence"),
            "reasons": verification.get("reasons") or [],
            "feedback": verification.get("feedback"),
        },
        "scores": {
            "difficulty": difficulty,
            "stretch": stretch,
            "points": points,
        },
        "status": status,
    })

    return {
        "submission_id": submission_id,
        "status": status,
        "verified": verified,
        "points": points,
        "difficulty": difficulty,
        "stretch": stretch,
        "feedback": verification.get("feedback"),
        "reasons": verification.get("reasons") or [],
        "photo_url": _photos().url_for(photo_path),
    }


def _enrich_standings(standings, submissions):
    by_uid = {}
    for s in submissions:
        by_uid.setdefault(s.get("uid"), []).append(s)
    photos = _photos()
    for entry in standings:
        items = []
        for s in by_uid.get(entry["uid"], []):
            scores = s.get("scores") or {}
            recipe = s.get("recipe") or {}
            verification = s.get("verification") or {}
            photo_path = s.get("photo_path")
            items.append({
                "id": s.get("id"),
                "recipe_name": recipe.get("name"),
                "photo_url": photos.url_for(photo_path) if photo_path else None,
                "points": scores.get("points", 0),
                "difficulty": scores.get("difficulty"),
                "stretch": scores.get("stretch"),
                "created_at": s.get("created_at"),
                "feedback": verification.get("feedback"),
                "status": s.get("status"),
            })
        items.sort(key=lambda i: (i.get("created_at") or ""), reverse=True)
        entry["submissions"] = items


def _with_top_dish_urls(results):
    photos = _photos()
    enriched = dict(results)
    top = []
    for dish in results.get("top_dishes") or []:
        item = dict(dish)
        photo_path = item.get("photo_path")
        item["photo_url"] = photos.url_for(photo_path) if photo_path else None
        top.append(item)
    enriched["top_dishes"] = top
    return enriched


def _finalize_week(circle_ref, week_key, now):
    all_members = [
        {
            "uid": (m.to_dict() or {}).get("uid"),
            "display_name": (m.to_dict() or {}).get("display_name"),
            "active": (m.to_dict() or {}).get("active"),
        }
        for m in circle_ref.collection("members").stream()
    ]
    submissions = _week_submissions(circle_ref, week_key)
    standings = build_standings(submissions, all_members)
    top_dishes = pick_top_dishes(submissions)

    winner = None
    if standings and standings[0]["total_points"] > 0:
        winner = {
            "uid": standings[0]["uid"],
            "display_name": standings[0]["display_name"],
            "total_points": standings[0]["total_points"],
        }

    doc = {
        "week_key": week_key,
        "finalized_at": now.isoformat(),
        "winner": winner,
        "standings": standings,
        "top_dishes": top_dishes,
    }
    results_ref = circle_ref.collection("weekly_results").document(week_key)
    try:
        results_ref.create(doc)
        return doc
    except AlreadyExists:
        return results_ref.get().to_dict() or {}


@router.get("/circles/{circle_id}/leaderboard")
@_guard_firestore
async def get_leaderboard(circle_id: str, week: str | None = None, uid: str = Depends(require_user)):
    db = _db()
    circle_ref = db.collection("circles").document(circle_id)
    circle, _ = _require_member(circle_ref, uid)

    tz_name = circle.get("timezone") or "UTC"
    now = now_utc()
    if week is None:
        wk = week_key_for(now, tz_name)
    else:
        if not re.match(r"^\d{4}-W\d{2}$", week):
            raise HTTPException(status_code=422, detail="Invalid week format")
        wk = week

    cutoff = week_cutoff_utc(wk, tz_name)
    submissions = _week_submissions(circle_ref, wk)
    active_members = [
        {
            "uid": (m.to_dict() or {}).get("uid"),
            "display_name": (m.to_dict() or {}).get("display_name"),
            "active": (m.to_dict() or {}).get("active"),
        }
        for m in circle_ref.collection("members").where("active", "==", True).stream()
    ]

    standings = build_standings(submissions, active_members)
    _enrich_standings(standings, submissions)

    results_ref = circle_ref.collection("weekly_results").document(wk)
    results_doc = results_ref.get()
    is_finalized = results_doc.exists
    results = None
    if is_finalized:
        results = results_doc.to_dict() or {}
    elif is_finalizable(wk, tz_name, now):
        results = _finalize_week(circle_ref, wk, now)
        is_finalized = True

    if results is not None:
        results = _with_top_dish_urls(results)

    return {
        "week_key": wk,
        "cutoff_utc": cutoff.isoformat(),
        "is_finalized": is_finalized,
        "standings": standings,
        "results": results,
    }


@router.get("/circles/{circle_id}/results/{week_key}")
@_guard_firestore
async def get_results(circle_id: str, week_key: str, uid: str = Depends(require_user)):
    db = _db()
    circle_ref = db.collection("circles").document(circle_id)
    circle, _ = _require_member(circle_ref, uid)

    if not re.match(r"^\d{4}-W\d{2}$", week_key):
        raise HTTPException(status_code=422, detail="Invalid week format")

    tz_name = circle.get("timezone") or "UTC"
    now = now_utc()
    results_ref = circle_ref.collection("weekly_results").document(week_key)
    results_doc = results_ref.get()
    if results_doc.exists:
        return _with_top_dish_urls(results_doc.to_dict() or {})
    if not is_finalizable(week_key, tz_name, now):
        raise HTTPException(status_code=404, detail="Week not finished yet")
    return _with_top_dish_urls(_finalize_week(circle_ref, week_key, now))
