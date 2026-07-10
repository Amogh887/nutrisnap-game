import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_import_main_fails_only_with_gemini_api_key_error():
    result = subprocess.run(
        [sys.executable, "-c", "import main"],
        cwd=str(BACKEND_DIR),
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode != 0
    assert result.stderr.count("Traceback") == 1
    assert "RuntimeError" in result.stderr
    assert "Missing GEMINI_API_KEY" in result.stderr
    assert "GOOGLE_APPLICATION_CREDENTIALS" not in result.stderr
    assert "ImportError" not in result.stderr
    assert "ModuleNotFoundError" not in result.stderr
