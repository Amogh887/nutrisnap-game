import json

EXPECTED_ROUTES = {
    ("/api/test", "get"),
    ("/api/analyze-food", "post"),
    ("/api/generate-recipe", "post"),
    ("/api/profile", "get"),
    ("/api/profile", "put"),
    ("/api/preferences", "get"),
    ("/api/preferences", "put"),
    ("/api/saved-recipes", "get"),
    ("/api/saved-recipes", "post"),
    ("/api/saved-recipes/{recipe_id}", "delete"),
    ("/api/food-history", "get"),
    ("/api/feedback", "post"),
    ("/api/circles", "post"),
    ("/api/circles", "get"),
    ("/api/circles/join", "post"),
    ("/api/circles/{circle_id}", "get"),
    ("/api/circles/{circle_id}/leave", "post"),
    ("/api/circles/{circle_id}/submissions", "post"),
    ("/api/circles/{circle_id}/leaderboard", "get"),
    ("/api/circles/{circle_id}/results/{week_key}", "get"),
}


def _flatten(paths):
    combos = set()
    for path, methods in paths.items():
        for method in methods:
            combos.add((path, method))
    return combos


def test_frontend_app_loads_with_dummy_env(load_frontend_openapi_paths):
    result = load_frontend_openapi_paths()
    assert result.returncode == 0, (
        f"frontend/api/_server/main.py failed to import with dummy env.\n"
        f"stdout={result.stdout}\nstderr={result.stderr}"
    )


def test_frontend_has_exactly_20_route_method_combinations(load_frontend_openapi_paths):
    result = load_frontend_openapi_paths()
    assert result.returncode == 0, result.stderr
    paths = json.loads(result.stdout)
    combos = _flatten(paths)
    assert len(combos) == 20, f"expected 20 route+method combos, got {len(combos)}: {sorted(combos)}"


def test_frontend_routes_match_expected_set_exactly(load_frontend_openapi_paths):
    result = load_frontend_openapi_paths()
    assert result.returncode == 0, result.stderr
    paths = json.loads(result.stdout)
    combos = _flatten(paths)
    missing = EXPECTED_ROUTES - combos
    extra = combos - EXPECTED_ROUTES
    assert not missing, f"missing expected routes: {sorted(missing)}"
    assert not extra, f"unexpected extra routes present: {sorted(extra)}"


def test_frontend_routes_match_backend_routes_exactly(load_frontend_openapi_paths, load_backend_openapi_paths):
    frontend_result = load_frontend_openapi_paths()
    backend_result = load_backend_openapi_paths()
    assert frontend_result.returncode == 0, frontend_result.stderr
    assert backend_result.returncode == 0, backend_result.stderr

    frontend_combos = _flatten(json.loads(frontend_result.stdout))
    backend_combos = _flatten(json.loads(backend_result.stdout))

    missing_in_frontend = backend_combos - frontend_combos
    extra_in_frontend = frontend_combos - backend_combos

    assert not missing_in_frontend, f"routes present in backend but missing in frontend copy: {sorted(missing_in_frontend)}"
    assert not extra_in_frontend, f"routes present in frontend copy but not in backend: {sorted(extra_in_frontend)}"
