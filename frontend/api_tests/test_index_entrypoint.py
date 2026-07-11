import json

from conftest import API_DIR, run_python_snippet, dummy_env_overlay


def test_index_py_loads_app_by_file_path_with_20_routes():
    code = (
        "import importlib.util, json, sys\n"
        f"spec = importlib.util.spec_from_file_location('vercel_index', {str(API_DIR / 'index.py')!r})\n"
        "module = importlib.util.module_from_spec(spec)\n"
        "spec.loader.exec_module(module)\n"
        "assert hasattr(module, 'app'), 'index module has no app attribute'\n"
        "paths = module.app.openapi()['paths']\n"
        "combos = sorted((p, m) for p, methods in paths.items() for m in methods)\n"
        "print(json.dumps(combos))\n"
    )
    result = run_python_snippet(code, cwd=API_DIR, extra_env=dummy_env_overlay())
    assert result.returncode == 0, f"stdout={result.stdout}\nstderr={result.stderr}"
    combos = json.loads(result.stdout)
    assert len(combos) == 20, f"expected 20 route+method combos via index.py, got {len(combos)}: {combos}"


def test_index_py_inserts_its_own_directory_onto_sys_path():
    index_source = (API_DIR / "index.py").read_text()
    assert "sys.path.insert(0, os.path.dirname(__file__))" in index_source
    assert "from _server.main import app" in index_source
