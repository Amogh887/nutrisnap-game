import subprocess

from conftest import BACKEND_DIR, SERVER_DIR


def _diff_lines(backend_file, frontend_file):
    result = subprocess.run(
        ["git", "diff", "--no-index", "--unified=0", str(backend_file), str(frontend_file)],
        capture_output=True,
        text=True,
    )
    assert result.returncode in (0, 1), f"git diff failed: {result.stderr}"
    return result.stdout


def test_deps_py_is_byte_identical_between_backend_and_frontend():
    diff = _diff_lines(BACKEND_DIR / "deps.py", SERVER_DIR / "deps.py")
    assert diff == "", f"deps.py unexpectedly differs:\n{diff}"


def test_game_py_differs_only_by_relative_import_lines():
    diff = _diff_lines(BACKEND_DIR / "game.py", SERVER_DIR / "game.py")
    changed_lines = [
        line for line in diff.splitlines()
        if (line.startswith("+") or line.startswith("-"))
        and not line.startswith("+++")
        and not line.startswith("---")
    ]
    assert changed_lines, "expected game.py to differ by import lines, but no diff found"
    for line in changed_lines:
        content = line[1:]
        assert content.startswith("from deps import") or content.startswith("from .deps import") \
            or content.startswith("from game_logic import") or content.startswith("from .game_logic import"), (
            f"unexpected non-import diff line in game.py: {line!r}"
        )


def test_game_py_uses_relative_imports_in_frontend_copy():
    content = (SERVER_DIR / "game.py").read_text()
    assert "from .deps import" in content
    assert "from .game_logic import" in content
    assert "from deps import" not in content
    assert "\nfrom game_logic import" not in content


def test_game_logic_py_is_byte_identical_between_backend_and_frontend():
    diff = _diff_lines(BACKEND_DIR / "game_logic.py", SERVER_DIR / "game_logic.py")
    assert diff == "", f"game_logic.py unexpectedly differs:\n{diff}"
