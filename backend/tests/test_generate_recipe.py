import pytest
from fastapi.testclient import TestClient

import main
from deps import require_user
from game_logic import compute_points
from fakes import FakeDb, FakeGenaiClient

FIXED_UID = "test-uid-primary"


class _FakeHttpResponse:
    text = ""


def _recipe(**overrides):
    recipe = {
        "name": "Egg Sandwich",
        "description": "Quick and tasty.",
        "servings": "1",
        "ingredients_used": ["2 eggs", "2 slices whole-grain bread"],
        "additional_ingredients": ["1 tsp butter"],
        "instructions": ["Fry the eggs.", "Assemble the sandwich."],
        "nutrition": {
            "calories_kcal": "350",
            "protein_g": "20",
            "carbs_g": "30",
            "fat_g": "15",
            "fiber_g": "4",
        },
        "health_score": "7",
        "health_explanation": "Balanced macros.",
        "diet_tags": ["high-protein"],
        "estimated_time_minutes": "10",
        "difficulty": 4,
        "stretch": 3,
        "youtube_query": "how to make an egg sandwich",
    }
    recipe.update(overrides)
    return recipe


@pytest.fixture
def fake_db():
    return FakeDb()


@pytest.fixture
def fake_genai():
    return FakeGenaiClient()


@pytest.fixture
def client(fake_db, fake_genai, monkeypatch):
    monkeypatch.setattr(main, "db", fake_db)
    monkeypatch.setattr(main, "client", fake_genai)
    monkeypatch.setattr(main.httpx, "get", lambda *args, **kwargs: _FakeHttpResponse())
    main.app.dependency_overrides[require_user] = lambda: FIXED_UID
    with TestClient(main.app) as test_client:
        yield test_client
    main.app.dependency_overrides.clear()


def test_generate_recipe_requires_auth(fake_db, fake_genai, monkeypatch):
    monkeypatch.setattr(main, "db", fake_db)
    monkeypatch.setattr(main, "client", fake_genai)
    monkeypatch.setattr(main.httpx, "get", lambda *args, **kwargs: _FakeHttpResponse())
    main.app.dependency_overrides.clear()
    with TestClient(main.app) as test_client:
        resp = test_client.post("/api/generate-recipe", json={"dish_name": "egg sandwich"})
    assert resp.status_code == 401


def test_generate_recipe_empty_name_returns_422(client):
    resp = client.post("/api/generate-recipe", json={"dish_name": "   "})
    assert resp.status_code == 422


def test_generate_recipe_too_long_name_returns_422(client):
    resp = client.post("/api/generate-recipe", json={"dish_name": "x" * 81})
    assert resp.status_code == 422


def test_generate_recipe_missing_body_returns_422(client):
    resp = client.post("/api/generate-recipe", json={})
    assert resp.status_code == 422


def test_generate_recipe_returns_single_recipe_with_points(client, fake_genai):
    fake_genai.queue(_recipe(difficulty=7, stretch=4))
    resp = client.post("/api/generate-recipe", json={"dish_name": "egg sandwich"})
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["detected_ingredients"] == []
    assert len(body["recipes"]) == 1
    recipe = body["recipes"][0]
    assert recipe["name"] == "Egg Sandwich"
    assert recipe["difficulty"] == 7
    assert recipe["stretch"] == 4
    assert recipe["points_estimate"] == compute_points(7, 4)
    assert recipe["nutrition"]["fiber_g"] == "4"


def test_generate_recipe_clamps_out_of_range_scores(client, fake_genai):
    fake_genai.queue(_recipe(difficulty=99, stretch=0))
    resp = client.post("/api/generate-recipe", json={"dish_name": "risotto"})
    assert resp.status_code == 200
    recipe = resp.json()["recipes"][0]
    assert recipe["difficulty"] == 10
    assert recipe["stretch"] == 1
    assert recipe["points_estimate"] == compute_points(10, 1)


def test_generate_recipe_unwraps_recipes_array(client, fake_genai):
    fake_genai.queue({"recipes": [_recipe(difficulty=5, stretch=5)], "detected_ingredients": ["ignored"]})
    resp = client.post("/api/generate-recipe", json={"dish_name": "pasta"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["detected_ingredients"] == []
    assert len(body["recipes"]) == 1
    assert body["recipes"][0]["points_estimate"] == compute_points(5, 5)


def test_generate_recipe_personalizes_prompt_from_preferences(client, fake_db, fake_genai):
    fake_db.collection("users").document(FIXED_UID).set(
        {"preferences": {"diet_type": "vegan", "allergies": "peanuts"}}
    )
    captured = {}
    original = fake_genai.generate_content

    def spy(model=None, contents=None, config=None):
        captured["contents"] = contents
        return original(model=model, contents=contents, config=config)

    fake_genai.generate_content = spy
    fake_genai.queue(_recipe())

    resp = client.post("/api/generate-recipe", json={"dish_name": "chickpea curry"})
    assert resp.status_code == 200
    prompt = captured["contents"][0]
    assert "vegan" in prompt
    assert "peanuts" in prompt
    assert "chickpea curry" in prompt


def test_analyze_food_attaches_points_estimate(client, fake_genai):
    fake_genai.queue(
        {
            "detected_ingredients": ["egg", "bread"],
            "recipes": [
                _recipe(difficulty=6, stretch=5),
                _recipe(name="Omelette", difficulty=3, stretch=2),
            ],
        }
    )
    resp = client.post(
        "/api/analyze-food",
        files={"image": ("food.jpg", b"fakebytes", "image/jpeg")},
    )
    assert resp.status_code == 200, resp.text
    recipes = resp.json()["recipes"]
    assert len(recipes) == 2
    assert recipes[0]["points_estimate"] == compute_points(6, 5)
    assert recipes[1]["points_estimate"] == compute_points(3, 2)


def test_analyze_food_response_stays_backward_compatible(client, fake_genai):
    fake_genai.queue(
        {
            "detected_ingredients": ["egg", "bread"],
            "recipes": [_recipe(difficulty=6, stretch=5)],
            "ranking": ["Egg Sandwich"],
        }
    )
    resp = client.post(
        "/api/analyze-food",
        files={"image": ("food.jpg", b"fakebytes", "image/jpeg")},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()

    assert body["detected_ingredients"] == ["egg", "bread"]
    assert body["ranking"] == ["Egg Sandwich"]

    recipe = body["recipes"][0]
    for field in (
        "name",
        "description",
        "servings",
        "ingredients_used",
        "additional_ingredients",
        "instructions",
        "nutrition",
        "health_score",
        "health_explanation",
        "diet_tags",
        "estimated_time_minutes",
        "youtube_query",
    ):
        assert field in recipe, f"pre-existing field {field!r} missing from analyze-food response"

    assert recipe["name"] == "Egg Sandwich"
    assert recipe["health_score"] == "7"
    assert recipe["nutrition"]["calories_kcal"] == "350"

    assert recipe.get("fiber_g") is None
    assert recipe["nutrition"]["fiber_g"] == "4"

    assert recipe["difficulty"] == 6
    assert recipe["stretch"] == 5
    assert recipe["points_estimate"] == compute_points(6, 5)


def test_generate_recipe_dish_name_at_max_length_is_accepted(client, fake_genai):
    fake_genai.queue(_recipe())
    resp = client.post("/api/generate-recipe", json={"dish_name": "x" * 80})
    assert resp.status_code == 200, resp.text


def test_generate_recipe_clamps_score_above_ten(client, fake_genai):
    fake_genai.queue(_recipe(difficulty=11, stretch=11))
    resp = client.post("/api/generate-recipe", json={"dish_name": "soup"})
    assert resp.status_code == 200
    recipe = resp.json()["recipes"][0]
    assert recipe["difficulty"] == 10
    assert recipe["stretch"] == 10
    assert recipe["points_estimate"] == compute_points(10, 10)


def test_generate_recipe_clamps_none_scores_to_minimum(client, fake_genai):
    fake_genai.queue(_recipe(difficulty=None, stretch=None))
    resp = client.post("/api/generate-recipe", json={"dish_name": "soup"})
    assert resp.status_code == 200
    recipe = resp.json()["recipes"][0]
    assert recipe["difficulty"] == 1
    assert recipe["stretch"] == 1
    assert recipe["points_estimate"] == compute_points(1, 1)


def test_generate_recipe_clamps_non_numeric_string_scores_to_minimum(client, fake_genai):
    fake_genai.queue(_recipe(difficulty="very hard", stretch="a lot"))
    resp = client.post("/api/generate-recipe", json={"dish_name": "soup"})
    assert resp.status_code == 200
    recipe = resp.json()["recipes"][0]
    assert recipe["difficulty"] == 1
    assert recipe["stretch"] == 1
    assert recipe["points_estimate"] == compute_points(1, 1)


def test_generate_recipe_coerces_numeric_string_scores(client, fake_genai):
    fake_genai.queue(_recipe(difficulty="8", stretch="2"))
    resp = client.post("/api/generate-recipe", json={"dish_name": "soup"})
    assert resp.status_code == 200
    recipe = resp.json()["recipes"][0]
    assert recipe["difficulty"] == 8
    assert recipe["stretch"] == 2
    assert recipe["points_estimate"] == compute_points(8, 2)


def test_generate_recipe_missing_score_fields_default_to_minimum(client, fake_genai):
    recipe = _recipe()
    del recipe["difficulty"]
    del recipe["stretch"]
    fake_genai.queue(recipe)
    resp = client.post("/api/generate-recipe", json={"dish_name": "soup"})
    assert resp.status_code == 200
    body = resp.json()["recipes"][0]
    assert body["difficulty"] == 1
    assert body["stretch"] == 1
    assert body["points_estimate"] == compute_points(1, 1)


def test_generate_recipe_does_not_touch_firestore_or_submission_data(client, fake_db, fake_genai):
    fake_db.collection("circles").document("circle1").set({"name": "Test Circle", "member_count": 1})
    snapshot_before = {path: dict(data) for path, data in fake_db.store.items()}

    fake_genai.queue(_recipe())
    resp = client.post("/api/generate-recipe", json={"dish_name": "egg sandwich"})
    assert resp.status_code == 200, resp.text

    assert fake_db.store == snapshot_before
    assert not any("submissions" in path for path in fake_db.store)
