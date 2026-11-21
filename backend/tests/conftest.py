"""Wspólne fixtures: izolowana baza na test, klient API, paczki COI rozpakowane raz na sesję."""

import os
import zipfile
from collections.abc import Iterator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("TESSDATA_PREFIX", str(Path.home() / ".local/share/tessdata"))

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
REFERENCE = ROOT / "app/coi/reference"
FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def coi_samples(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Paczki z data-pdf/*.zip rozpakowane do katalogu tymczasowego (każda w osobnym podkatalogu)."""
    zips = sorted((REPO / "data-pdf").glob("*.zip"))
    if not zips:
        pytest.skip("Brak paczek COI w data-pdf/")
    out = tmp_path_factory.mktemp("coi")
    for i, z in enumerate(zips, start=1):
        with zipfile.ZipFile(z) as zf:
            zf.extractall(out / f"z{i:02d}")
    return out


def sample_files(root: Path) -> list[Path]:
    skip_ext = {".json", ".zip"}
    return sorted(
        p for p in root.rglob("*")
        if p.is_file() and p.suffix.lower() not in skip_ext and "wizualizacja" not in p.name
        and "Materiały do zadania" not in str(p)
    )


@pytest.fixture
def settings_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Iterator[Path]:
    """Świeża baza SQLite i katalog danych na każdy test; LLM i auth wyłączone."""
    data = tmp_path / "data"
    (data / "statutes").mkdir(parents=True)
    (data / "dictionaries").mkdir()
    for p in (ROOT / "data/dictionaries").glob("*.json"):
        (data / "dictionaries" / p.name).write_text(p.read_text())
    (data / "prefill_mock.json").write_text((ROOT / "data/prefill_mock.json").read_text())
    (data / "statutes" / "ustawa_testowa.txt").write_text((FIXTURES / "ustawa_testowa.txt").read_text())
    monkeypatch.setenv("DATA_DIR", str(data))
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.sqlite3"))
    monkeypatch.setenv("LLM_ENABLED", "false")
    monkeypatch.setenv("AUTH_ENABLED", "false")
    from app.config import get_settings
    from app.legal.index import get_index

    get_settings.cache_clear()
    get_index.cache_clear()
    yield data
    get_settings.cache_clear()
    get_index.cache_clear()


@pytest.fixture
def client(settings_env: Path) -> Iterator[TestClient]:
    from app.main import app

    with TestClient(app) as c:
        yield c
