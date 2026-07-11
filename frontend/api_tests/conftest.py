import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

TESTS_DIR = Path(__file__).resolve().parent
FRONTEND_DIR = TESTS_DIR.parent
API_DIR = FRONTEND_DIR / "api"
REPO_ROOT = FRONTEND_DIR.parent
BACKEND_DIR = REPO_ROOT / "backend"
SERVER_DIR = API_DIR / "_server"


def make_dummy_service_account_json(project_id="dummy-project"):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("utf-8")
    client_email = f"dummy@{project_id}.iam.gserviceaccount.com"
    return json.dumps({
        "type": "service_account",
        "project_id": project_id,
        "private_key_id": "dummykeyid",
        "private_key": pem,
        "client_email": client_email,
        "client_id": "1234567890",
        "auth_uri": "https://accounts.google.com/o/oauth2/auth",
        "token_uri": "https://oauth2.googleapis.com/token",
        "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
        "client_x509_cert_url": f"https://www.googleapis.com/robot/v1/metadata/x509/{client_email}",
        "universe_domain": "googleapis.com",
    })


def dummy_env_overlay():
    return {
        "GCP_SERVICE_ACCOUNT_JSON": make_dummy_service_account_json(),
        "GCP_PROJECT_ID": "dummy-project",
        "GEMINI_API_KEY": "dummy-gemini-key",
        "FIREBASE_STORAGE_BUCKET": "dummy-project.firebasestorage.app",
    }


@pytest.fixture
def dummy_env():
    return dummy_env_overlay()


def run_python_snippet(code, cwd, extra_env, timeout=30):
    env = os.environ.copy()
    env.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
    env.pop("FRONTEND_ORIGINS", None)
    env.update(extra_env)
    return subprocess.run(
        [sys.executable, "-c", code],
        cwd=str(cwd),
        env=env,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


@pytest.fixture
def load_frontend_openapi_paths():
    def _load(extra_env=None):
        env = dummy_env_overlay()
        if extra_env:
            env.update(extra_env)
        code = (
            "import sys, json\n"
            f"sys.path.insert(0, {str(API_DIR)!r})\n"
            "from _server.main import app\n"
            "print(json.dumps(app.openapi()['paths']))\n"
        )
        result = run_python_snippet(code, cwd=API_DIR, extra_env=env)
        return result
    return _load


@pytest.fixture
def load_backend_openapi_paths():
    def _load(extra_env=None):
        env = dummy_env_overlay()
        if extra_env:
            env.update(extra_env)
        code = (
            "import sys, json\n"
            f"sys.path.insert(0, {str(BACKEND_DIR)!r})\n"
            "import main\n"
            "print(json.dumps(main.app.openapi()['paths']))\n"
        )
        result = run_python_snippet(code, cwd=BACKEND_DIR, extra_env=env)
        return result
    return _load
