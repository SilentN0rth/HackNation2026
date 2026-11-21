import io
import zipfile

import pytest

from app.config import get_settings
from app.errors import ApiError
from app.uploads import check_content, validate_filename

PDF = b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32


@pytest.mark.parametrize("name", ["wniosek;1.pdf", "a:b.pdf", "x>y.pdf", "x<y.pdf", "a/b.pdf", "a\\b.pdf", "a|b.pdf", "a'b.pdf", "a*b.pdf", "a%b.pdf", "a$b.pdf"])
def test_forbidden_characters(name):
    with pytest.raises(ApiError) as exc:
        validate_filename(name)
    assert exc.value.status == 422


def test_name_length():
    assert validate_filename("a" * 246 + ".pdf") == ".pdf"
    with pytest.raises(ApiError):
        validate_filename("a" * 247 + ".pdf")


def test_unsupported_extension():
    with pytest.raises(ApiError) as exc:
        validate_filename("wniosek.txt")
    assert exc.value.status == 415


def test_content_must_match_extension():
    assert check_content("wniosek.pdf", PDF).kind == "pdf"
    with pytest.raises(ApiError) as exc:
        check_content("wniosek.pdf", PNG)
    assert exc.value.status == 415
    with pytest.raises(ApiError):
        check_content("skan.jpg", PNG)


def test_uppercase_extension_is_accepted():
    assert check_content("WNIOSEK.PDF", PDF).extension == ".pdf"


def test_empty_file():
    with pytest.raises(ApiError):
        check_content("wniosek.pdf", b"")


def test_zip_bomb(monkeypatch):
    monkeypatch.setattr(get_settings(), "max_unpacked_mb", 1)
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", b"0" * (3 * 1024 * 1024))
    with pytest.raises(ApiError) as exc:
        check_content("wniosek.docx", buffer.getvalue())
    assert "rozpakowaniu" in exc.value.detail
