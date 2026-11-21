import pytest

from app import config
from app.main import create_app


@pytest.fixture
def fresh_settings():
    config.get_settings.cache_clear()
    config.jwt_secret.cache_clear()
    yield
    config.get_settings.cache_clear()
    config.jwt_secret.cache_clear()


def test_missing_jwt_secret_stops_startup(monkeypatch, tmp_path, fresh_settings):
    monkeypatch.setenv("JWT_SECRET", "")
    monkeypatch.setenv("JWT_SECRET_FILE", str(tmp_path / "brak.txt"))
    with pytest.raises(RuntimeError, match="make-secrets.sh"):
        create_app()


def test_jwt_secret_from_file(monkeypatch, tmp_path, fresh_settings):
    secret = tmp_path / "jwt_secret.txt"
    secret.write_text("sekret-z-pliku\n")
    monkeypatch.setenv("JWT_SECRET", "")
    monkeypatch.setenv("JWT_SECRET_FILE", str(secret))
    assert config.jwt_secret() == "sekret-z-pliku"


def test_without_auth_secret_is_optional(monkeypatch, tmp_path, fresh_settings):
    monkeypatch.setenv("AUTH_ENABLED", "false")
    monkeypatch.setenv("JWT_SECRET", "")
    monkeypatch.setenv("JWT_SECRET_FILE", str(tmp_path / "brak.txt"))
    create_app()
    assert config.jwt_secret()
