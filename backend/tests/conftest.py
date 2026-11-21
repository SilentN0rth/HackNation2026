import os
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ.update({"AUTH_ENABLED": "true", "JWT_SECRET": "test-secret-for-pytest-only-0123456789", "DB_PATH": ":memory:", "LLM_ENABLED": "false"})

from fastapi.testclient import TestClient  # noqa: E402

from app.main import create_app  # noqa: E402
from app.store.db import Store, get_store  # noqa: E402

FIXTURES = ROOT / "tests" / "fixtures"
SAMPLES = ROOT.parent / "data-pdf"


def sample(prefix: str, extension: str) -> tuple[str, bytes]:
    archive_path = next(SAMPLES.glob(f"{prefix}.*.zip"), None)
    if archive_path is None:
        pytest.skip("Brak przykładowych formularzy w data-pdf")
    with zipfile.ZipFile(archive_path) as archive:
        for name in archive.namelist():
            if name.lower().endswith(extension) and "wizualizacja" not in name:
                return Path(name).name, archive.read(name)
    pytest.skip(f"Brak pliku {extension} w paczce {prefix}")


@pytest.fixture
def store() -> Store:
    return Store(":memory:")


@pytest.fixture
def client(store: Store) -> TestClient:
    app = create_app()
    app.dependency_overrides[get_store] = lambda: store
    return TestClient(app)


def token(client: TestClient, user_id: str) -> dict:
    response = client.post("/auth/token", json={"userId": user_id})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def official(client: TestClient) -> dict:
    return token(client, "u-urzednik")


@pytest.fixture
def citizen(client: TestClient) -> dict:
    return token(client, "u-obywatel")
