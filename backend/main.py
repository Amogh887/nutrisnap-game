import os
import json
from pathlib import Path
from pydantic import BaseModel
import re
import httpx
from datetime import datetime, timezone
from uuid import uuid4
from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
from dotenv import load_dotenv

from google import genai
from google.genai import types

import firebase_admin
from firebase_admin import credentials, firestore
from google.api_core.exceptions import PermissionDenied as GooglePermissionDenied
from google.api_core.exceptions import ServiceUnavailable as GoogleServiceUnavailable

from deps import get_current_user, require_user, DEFAULT_PREFERENCES
from game import router as game_router, init_game
from game_logic import compute_points
from photo_store import LocalPhotoStore

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / '.env')

service_account_json = os.getenv('GCP_SERVICE_ACCOUNT_JSON')
credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

if service_account_json:
    temp_path = Path('/tmp/gcp-service-account.json')
    temp_path.write_text(service_account_json, encoding='utf-8')
    credentials_path = str(temp_path)
elif credentials_path:
    credentials_file = Path(credentials_path)
    if not credentials_file.is_absolute():
        credentials_file = BASE_DIR / credentials_file
    if credentials_file.exists():
        credentials_path = str(credentials_file.resolve())
    else:
        credentials_path = None

if credentials_path:
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = credentials_path

app = FastAPI()

frontend_origins = os.getenv("FRONTEND_ORIGINS")
if frontend_origins:
    allow_origins = [origin.strip() for origin in frontend_origins.split(",") if origin.strip()]
else:
    # Token-based auth (Authorization header) does not require CORS credentials.
    # Keep dev CORS permissive so any local dev origin can call the API.
    allow_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if not firebase_admin._apps:
    cert_path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
    if not cert_path:
        raise RuntimeError('Missing GOOGLE_APPLICATION_CREDENTIALS or GCP_SERVICE_ACCOUNT_JSON')
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred, {
        'projectId': os.getenv("GCP_PROJECT_ID"),
    })

db = firestore.client()

gemini_api_key = os.getenv("GEMINI_API_KEY")
if not gemini_api_key:
    raise RuntimeError("Missing GEMINI_API_KEY - get a free key at https://aistudio.google.com and add it to backend/.env")
client = genai.Client(api_key=gemini_api_key)

MEDIA_DIR = BASE_DIR / "media"
MEDIA_DIR.mkdir(parents=True, exist_ok=True)
photo_store = LocalPhotoStore(MEDIA_DIR)
init_game(db, client, photo_store)
app.include_router(game_router)
app.mount("/media", StaticFiles(directory=str(MEDIA_DIR)), name="media")


FIRESTORE_PERMISSION_DETAIL = (
    "Firestore access denied for backend service account. "
    "Grant Firestore/Datastore permissions (for example roles/datastore.user) "
    "to the service account and ensure Firestore is enabled in this project."
)
LOCAL_DATA_DIR = BASE_DIR / "local_data"


def _is_firestore_unavailable(exc: Exception) -> bool:
    return isinstance(exc, (GooglePermissionDenied, GoogleServiceUnavailable))


def _ensure_local_store_dir() -> None:
    LOCAL_DATA_DIR.mkdir(parents=True, exist_ok=True)


def _user_store_path(uid: str) -> Path:
    safe_uid = "".join(ch for ch in uid if ch.isalnum() or ch in ("-", "_"))
    return LOCAL_DATA_DIR / f"{safe_uid}.json"


def _default_user_store() -> dict:
    return {
        "profile": {},
        "preferences": DEFAULT_PREFERENCES.copy(),
        "saved_recipes": [],
        "food_history": [],
        "feedback": [],
    }


def _read_user_store(uid: str) -> dict:
    _ensure_local_store_dir()
    path = _user_store_path(uid)
    if not path.exists():
        return _default_user_store()
    try:
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return _default_user_store()

    merged = _default_user_store()
    merged.update(data if isinstance(data, dict) else {})
    merged["preferences"] = {**DEFAULT_PREFERENCES, **(merged.get("preferences") or {})}
    if not isinstance(merged.get("saved_recipes"), list):
        merged["saved_recipes"] = []
    if not isinstance(merged.get("food_history"), list):
        merged["food_history"] = []
    if not isinstance(merged.get("feedback"), list):
        merged["feedback"] = []
    if not isinstance(merged.get("profile"), dict):
        merged["profile"] = {}
    return merged


def _write_user_store(uid: str, data: dict) -> None:
    _ensure_local_store_dir()
    path = _user_store_path(uid)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ─── Preference Fetcher ──────────────────────────────────────────────────────

def get_user_preferences(uid: str | None) -> dict:
    """Fetch user preferences from Firestore, fall back to defaults."""
    if not uid:
        return DEFAULT_PREFERENCES
    try:
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            data = doc.to_dict()
            prefs = data.get("preferences", {})
            # Merge with defaults so missing fields are always filled
            return {**DEFAULT_PREFERENCES, **prefs}
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            return {**DEFAULT_PREFERENCES, **(local.get("preferences") or {})}
        print(f"Could not fetch preferences for {uid}: {e}")
    return DEFAULT_PREFERENCES


# ─── Dynamic Prompt Builder ──────────────────────────────────────────────────

def build_prompt(prefs: dict) -> str:
    return f"""
    You are NutriSnap AI, an advanced multimodal nutrition and cooking assistant built to help users create healthy meals from available ingredients.

    Your task is to analyze an image of food ingredients and generate healthy, personalized recipe suggestions.

    ---
    ### STEP 1: INGREDIENT DETECTION
    Carefully analyze the provided image and identify all visible food ingredients.
    - Only include ingredients you are reasonably confident about.
    - Use generic names (e.g., "tomato", "chicken breast", "spinach", "rice").
    - Ignore non-food items.
    - If uncertain, include with "possible" tag.

    ---
    ### STEP 2: USER PROFILE & PREFERENCES
    Tailor ALL recipes strictly to this user's profile:
    - Health Goal: {prefs['health_goal']}
    - Diet Type: {prefs['diet_type']}
    - Allergies / Restrictions: {prefs['allergies']}
    - Cooking Time Preference: {prefs['cooking_time']}
    - Cuisine Preferences: {prefs['cuisine_preferences']}
    - Calorie Target: {prefs['calorie_target']}
    - Fitness Goal: {prefs['fitness_goal']}

    IMPORTANT: If the user has allergies, NEVER include those ingredients.
    If diet type is vegetarian or vegan, NEVER suggest meat or animal products.
    Adjust portion sizes and macros to match their calorie target and fitness goal.

    ---
    ### STEP 3: RECIPE GENERATION
    Generate 3 to 5 recipe suggestions using the detected ingredients.
    Rules:
    - Prioritize recipes that use MOST of the detected ingredients.
    - Focus on HEALTHY cooking methods (grilling, baking, steaming, sautéing with minimal oil).
    - Respect the user's cooking time preference.
    - EXTREMELY IMPORTANT: Provide EXACT measurements and portion sizes for EVERY ingredient (e.g., "150g", "2 cups", "1 tbsp"). Do not simply list the item.
    - Define an accurate total Yield/Servings for the recipe.
    - If additional ingredients are required, list them with precise quantities.
    - MOBILE FRIENDLY FORMATTING: Keep all descriptions and instructions EXTREMELY concise, punchy, and short. Do not write paragraphs. Use 1-2 sentences max for descriptions. Keep each instruction step to one short sentence.

    ---
    ### STEP 4: HEALTH OPTIMIZATION
    Each recipe must be optimized for the user's specific health goal:
    - For weight loss: lower calories, high protein, high fiber
    - For muscle gain: high protein, adequate carbs, moderate fat
    - For balanced: even macronutrient distribution
    - For keto: high fat, very low carbs
    - Always prefer whole, unprocessed ingredients

    ---
    ### STEP 5: HEALTH SCORING SYSTEM
    Assign each recipe a Health Score (1-10) based on:
    - Nutrient density
    - Macronutrient balance relative to user's fitness goal
    - Cooking method
    - Use of whole vs processed ingredients
    - Alignment with user's dietary preferences
    Also include a short explanation: Why the score is high or low for THIS user.

    ---
    ### STEP 6: COMPETITION SCORING
    Also rate each recipe on two 1-10 scales used by the cooking competition:
    - difficulty (1-10): Objective difficulty of the recipe based on techniques, timing sensitivity, and coordinating multiple components.
    - stretch (1-10): How far this dish sits outside THIS cook's comfort zone given their profile above — skill gap, unfamiliar cuisine vs their cuisine preferences, time vs their cooking time preference. An experienced cook making a staple of their favorite cuisine is 1-2; a beginner attempting an unfamiliar advanced dish is 8+.

    ---
    ### STEP 7: OUTPUT FORMAT
    Return ONLY valid JSON in the following structure:
    {{
      "detected_ingredients": [],
      "recipes": [
        {{
          "name": "",
          "description": "",
          "servings": "",
          "ingredients_used": ["e.g., 2 cups spinach", "1 tbsp olive oil"],
          "additional_ingredients": ["exact quantities required"],
          "instructions": ["step 1", "step 2"],
          "nutrition": {{
            "calories_kcal": "",
            "protein_g": "",
            "carbs_g": "",
            "fat_g": "",
            "fiber_g": ""
          }},
          "health_score": "",
          "health_explanation": "",
          "diet_tags": ["high-protein", "low-carb", "vegan"],
          "estimated_time_minutes": "",
          "difficulty": 5,
          "stretch": 5,
          "youtube_query": "specific search string for a recipe tutorial, e.g. 'how to make healthy grilled chicken breast'"
        }}
      ],
      "ranking": ["recipe_name_1", "recipe_name_2", "recipe_name_3"]
    }}

    ---
    ### STEP 8: RANKING
    Sort recipes from most to least aligned with the user's health goal and preferences.

    ---
    ### STEP 9: EDGE CASE HANDLING
    - If ingredients are insufficient, suggest 2-3 missing ingredients to create viable recipes.
    - If the image is unclear, make best reasonable assumptions.
    - Always provide useful output even with limited ingredients.

    ---
    ### FINAL INSTRUCTION
    Your response MUST be valid JSON only. No extra text, no explanations outside JSON.
    Personalization is critical — recipes must feel tailored to this specific user.
    """


def build_recipe_prompt(dish_name: str, prefs: dict) -> str:
    return f"""
    You are NutriSnap AI, a nutrition and cooking assistant.

    The user wants to cook this dish: "{dish_name}"

    Create EXACTLY ONE healthy recipe for this dish, personalized to this user's profile:
    - Health Goal: {prefs['health_goal']}
    - Diet Type: {prefs['diet_type']}
    - Allergies / Restrictions: {prefs['allergies']}
    - Cooking Time Preference: {prefs['cooking_time']}
    - Cuisine Preferences: {prefs['cuisine_preferences']}
    - Calorie Target: {prefs['calorie_target']}
    - Fitness Goal: {prefs['fitness_goal']}

    IMPORTANT: If the user has allergies, NEVER include those ingredients.
    If diet type is vegetarian or vegan, NEVER suggest meat or animal products.
    Adjust portions and macros to match their calorie target and fitness goal.
    Provide EXACT measurements for every ingredient.
    Keep it MOBILE FRIENDLY: 1-2 short sentences for the description, one short sentence per instruction step.

    Also rate this recipe on two 1-10 scales used by the cooking competition:
    - difficulty (1-10): Objective difficulty of the recipe based on techniques, timing sensitivity, and coordinating multiple components.
    - stretch (1-10): How far this dish sits outside THIS cook's comfort zone given their profile above — skill gap, unfamiliar cuisine vs their cuisine preferences, time vs their cooking time preference. An experienced cook making a staple of their favorite cuisine is 1-2; a beginner attempting an unfamiliar advanced dish is 8+.

    Return ONLY valid JSON for a single recipe in EXACTLY this structure:
    {{
      "name": "",
      "description": "",
      "servings": "",
      "ingredients_used": ["e.g., 2 eggs", "2 slices whole-grain bread"],
      "additional_ingredients": ["exact quantities required"],
      "instructions": ["step 1", "step 2"],
      "nutrition": {{
        "calories_kcal": "",
        "protein_g": "",
        "carbs_g": "",
        "fat_g": "",
        "fiber_g": ""
      }},
      "health_score": "",
      "health_explanation": "",
      "diet_tags": ["high-protein", "low-carb", "vegan"],
      "estimated_time_minutes": "",
      "difficulty": 5,
      "stretch": 5,
      "youtube_query": "specific search string for a recipe tutorial"
    }}

    Your response MUST be valid JSON only. No text outside the JSON object.
    """


def strip_json_fence(response_text: str) -> str:
    text = response_text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return text


def enrich_youtube_thumbnails(recipes: list) -> None:
    for recipe in recipes:
        if not isinstance(recipe, dict):
            continue
        try:
            query = recipe.get("youtube_query")
            if query:
                r = httpx.get(f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}", timeout=5.0)
                video_ids = re.findall(r"watch\?v=([a-zA-Z0-9_-]{11})", r.text)
                if video_ids:
                    vid = video_ids[0]
                    recipe["youtube_video_id"] = vid
                    recipe["youtube_thumbnail"] = f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"
        except Exception:
            pass


def _coerce_score(value) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = 1
    return max(1, min(10, n))


def attach_points_estimate(recipes: list) -> None:
    for recipe in recipes:
        if not isinstance(recipe, dict):
            continue
        difficulty = _coerce_score(recipe.get("difficulty"))
        stretch = _coerce_score(recipe.get("stretch"))
        recipe["difficulty"] = difficulty
        recipe["stretch"] = stretch
        recipe["points_estimate"] = compute_points(difficulty, stretch)


# ─── Test Endpoint ───────────────────────────────────────────────────────────

@app.get("/api/test")
async def test_connection():
    return {"message": "Hello from the FastAPI backend!"}


# ─── Analyze Food (personalized) ─────────────────────────────────────────────

@app.post("/api/analyze-food")
async def analyze_food(
    image: UploadFile = File(...),
    uid: str | None = Depends(get_current_user)
):
    try:
        # Fetch preferences (works for both guests and logged-in users)
        prefs = get_user_preferences(uid)

        file_bytes = await image.read()
        image_part = types.Part.from_bytes(data=file_bytes, mime_type=image.content_type)

        # Build personalized prompt
        prompt = build_prompt(prefs)

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[image_part, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        recipe_data = json.loads(strip_json_fence(response.text))

        recipes = recipe_data.get("recipes", [])
        enrich_youtube_thumbnails(recipes)
        attach_points_estimate(recipes)

        ingredients = recipe_data.get("detected_ingredients", [])
        if len(ingredients) < 2:
            raise HTTPException(
                status_code=400,
                detail="Not enough ingredients detected. Please try a clearer picture with more visible food items."
            )

        # Auto-save to food history if user is logged in
        if uid:
            try:
                from google.cloud.firestore import SERVER_TIMESTAMP
                history_entry = {
                    "detected_ingredients": ingredients,
                    "recipes_generated": [r["name"] for r in recipe_data.get("recipes", [])],
                    "analyzed_at": SERVER_TIMESTAMP,
                    "preferences_used": prefs
                }
                db.collection("users").document(uid).collection("food_history").document().set(history_entry)
            except Exception as e:
                if _is_firestore_unavailable(e):
                    local = _read_user_store(uid)
                    history_entry = {
                        "id": str(uuid4()),
                        "detected_ingredients": ingredients,
                        "recipes_generated": [r["name"] for r in recipe_data.get("recipes", [])],
                        "analyzed_at": _now_iso(),
                        "preferences_used": prefs,
                    }
                    local["food_history"] = [history_entry, *(local.get("food_history") or [])][:50]
                    _write_user_store(uid, local)
                else:
                    print(f"Could not save food history: {e}")

        return recipe_data

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"ERROR: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


class GenerateRecipeBody(BaseModel):
    dish_name: str


@app.post("/api/generate-recipe")
async def generate_recipe(body: GenerateRecipeBody, uid: str = Depends(require_user)):
    dish_name = (body.dish_name or "").strip()
    if not dish_name:
        raise HTTPException(status_code=422, detail="Dish name is required")
    if len(dish_name) > 80:
        raise HTTPException(status_code=422, detail="Dish name must be 80 characters or fewer")

    try:
        prefs = get_user_preferences(uid)
        prompt = build_recipe_prompt(dish_name, prefs)

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )

        recipe = json.loads(strip_json_fence(response.text))
        recipes = recipe.get("recipes") if isinstance(recipe, dict) and "recipes" in recipe else [recipe]

        enrich_youtube_thumbnails(recipes)
        attach_points_estimate(recipes)

        return {"recipes": recipes, "detected_ingredients": []}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"ERROR: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── User Profile ────────────────────────────────────────────────────────────

@app.get("/api/profile")
async def get_profile(uid: str = Depends(require_user)):
    try:
        doc = db.collection("users").document(uid).get()
        if not doc.exists:
            return {"uid": uid, "profile": {}, "preferences": DEFAULT_PREFERENCES}
        return doc.to_dict()
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            return {"uid": uid, "profile": local.get("profile", {}), "preferences": local.get("preferences", DEFAULT_PREFERENCES)}
        raise


@app.put("/api/profile")
async def update_profile(data: dict, uid: str = Depends(require_user)):
    try:
        db.collection("users").document(uid).set(data, merge=True)
        return {"message": "Profile updated"}
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            incoming_profile = data.get("profile", {}) if isinstance(data, dict) else {}
            local["profile"] = {**(local.get("profile") or {}), **incoming_profile}
            _write_user_store(uid, local)
            return {"message": "Profile updated"}
        raise


# ─── Preferences ─────────────────────────────────────────────────────────────

@app.get("/api/preferences")
async def get_preferences(uid: str = Depends(require_user)):
    prefs = get_user_preferences(uid)
    return prefs


@app.put("/api/preferences")
async def update_preferences(prefs: dict, uid: str = Depends(require_user)):
    try:
        db.collection("users").document(uid).set({"preferences": prefs}, merge=True)
        return {"message": "Preferences updated", "preferences": prefs}
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            local["preferences"] = {**DEFAULT_PREFERENCES, **(prefs or {})}
            _write_user_store(uid, local)
            return {"message": "Preferences updated", "preferences": local["preferences"]}
        raise


# ─── Saved Recipes ───────────────────────────────────────────────────────────

@app.get("/api/saved-recipes")
async def get_saved_recipes(uid: str = Depends(require_user)):
    try:
        recipes_ref = db.collection("users").document(uid).collection("saved_recipes")
        docs = recipes_ref.order_by("saved_at", direction=firestore.Query.DESCENDING).stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            return local.get("saved_recipes", [])
        raise


@app.post("/api/saved-recipes")
async def save_recipe(recipe: dict, uid: str = Depends(require_user)):
    try:
        from google.cloud.firestore import SERVER_TIMESTAMP
        recipe["saved_at"] = SERVER_TIMESTAMP
        ref = db.collection("users").document(uid).collection("saved_recipes").document()
        ref.set(recipe)
        return {"id": ref.id, "message": "Recipe saved"}
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            saved_id = str(uuid4())
            saved_recipe = {**recipe, "id": saved_id, "saved_at": _now_iso()}
            local["saved_recipes"] = [saved_recipe, *(local.get("saved_recipes") or [])]
            _write_user_store(uid, local)
            return {"id": saved_id, "message": "Recipe saved"}
        raise


@app.delete("/api/saved-recipes/{recipe_id}")
async def delete_saved_recipe(recipe_id: str, uid: str = Depends(require_user)):
    try:
        db.collection("users").document(uid).collection("saved_recipes").document(recipe_id).delete()
        return {"message": "Recipe deleted"}
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            local["saved_recipes"] = [
                item for item in (local.get("saved_recipes") or []) if item.get("id") != recipe_id
            ]
            _write_user_store(uid, local)
            return {"message": "Recipe deleted"}
        raise


# ─── Food History ────────────────────────────────────────────────────────────

@app.get("/api/food-history")
async def get_food_history(uid: str = Depends(require_user)):
    try:
        history_ref = db.collection("users").document(uid).collection("food_history")
        docs = history_ref.order_by("analyzed_at", direction=firestore.Query.DESCENDING).limit(50).stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            return (local.get("food_history") or [])[:50]
        raise


# ─── Feedback ────────────────────────────────────────────────────────────────

@app.post("/api/feedback")
async def submit_feedback(payload: dict, uid: str = Depends(require_user)):
    feedback_entry = {
        "recipe_name": payload.get("recipe_name"),
        "feedback_type": payload.get("feedback_type"),
        "created_at": _now_iso(),
    }
    try:
        from google.cloud.firestore import SERVER_TIMESTAMP

        firestore_entry = {
            "recipe_name": payload.get("recipe_name"),
            "feedback_type": payload.get("feedback_type"),
            "created_at": SERVER_TIMESTAMP,
        }
        db.collection("users").document(uid).collection("feedback").document().set(firestore_entry)
        return {"message": "Feedback submitted"}
    except Exception as e:
        if _is_firestore_unavailable(e):
            local = _read_user_store(uid)
            local["feedback"] = [feedback_entry, *(local.get("feedback") or [])][:100]
            _write_user_store(uid, local)
            return {"message": "Feedback submitted"}
        raise


# ─── Run ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

