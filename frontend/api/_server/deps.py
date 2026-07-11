from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from firebase_admin import auth


security = HTTPBearer(auto_error=False)


DEFAULT_PREFERENCES = {
    "health_goal": "balanced",
    "diet_type": "non-vegetarian",
    "allergies": "none",
    "cooking_time": "moderate",
    "cuisine_preferences": "any",
    "calorie_target": "not specified",
    "fitness_goal": "general health"
}


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        return None
    try:
        decoded_token = auth.verify_id_token(credentials.credentials)
        return decoded_token["uid"]
    except Exception:
        return None


def require_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    uid = get_current_user(credentials)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


def get_user_preferences(db, uid: str | None) -> dict:
    if not uid:
        return DEFAULT_PREFERENCES
    try:
        doc = db.collection("users").document(uid).get()
        if doc.exists:
            data = doc.to_dict()
            prefs = data.get("preferences", {})
            return {**DEFAULT_PREFERENCES, **prefs}
    except Exception:
        return DEFAULT_PREFERENCES
    return DEFAULT_PREFERENCES
