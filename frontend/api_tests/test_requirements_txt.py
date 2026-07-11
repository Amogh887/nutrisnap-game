import re
import subprocess
import sys

from conftest import FRONTEND_DIR

REQUIRED_PACKAGES = {
    "fastapi",
    "uvicorn",
    "python-multipart",
    "python-dotenv",
    "firebase-admin",
    "google-cloud-firestore",
    "google-cloud-storage",
    "google-genai",
    "httpx",
}


def _parse_package_names(requirements_text):
    names = set()
    for line in requirements_text.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        match = re.match(r"^([A-Za-z0-9_.\-]+)", line)
        if match:
            names.add(match.group(1).lower())
    return names


def test_requirements_txt_lists_full_stack_including_cloud_storage():
    requirements_path = FRONTEND_DIR / "requirements.txt"
    assert requirements_path.exists()
    names = _parse_package_names(requirements_path.read_text())
    missing = REQUIRED_PACKAGES - names
    assert not missing, f"requirements.txt is missing required packages: {missing}"


def test_requirements_txt_pip_dry_run_resolves():
    requirements_path = FRONTEND_DIR / "requirements.txt"
    result = subprocess.run(
        [sys.executable, "-m", "pip", "install", "--dry-run", "-r", str(requirements_path)],
        capture_output=True,
        text=True,
        timeout=120,
    )
    assert result.returncode == 0, f"pip dry-run failed:\nstdout={result.stdout}\nstderr={result.stderr}"
