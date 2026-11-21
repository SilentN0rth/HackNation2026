"""[1] Walidacja uploadu: rozszerzenie + magic bytes + zgodność, nazwa pliku, rozmiar, zip bomba.

Plik żyje wyłącznie w pamięci. W bazie zostaje tylko sha256 i nazwa.
"""

import hashlib
import io
import re
import unicodedata
import zipfile
from dataclasses import dataclass

import filetype
import olefile

from app.config import Settings
from app.errors import ApiError

FORBIDDEN_CHARS = re.compile(r"[;:><\/\\|'*%$]")
CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")

# rozszerzenie -> rodzaj kontenera wykrytego po sygnaturze
EXT_KIND = {
    ".pdf": "pdf",
    ".doc": "ole",
    ".docx": "docx",
    ".xlsx": "xlsx",
    ".ods": "ods",
    ".jpg": "jpeg",
    ".jpeg": "jpeg",
    ".jpe": "jpeg",
    ".png": "png",
}

# Dopuszczalne „niezgodności” spotykane w praktyce urzędów: DOCX zapisany z rozszerzeniem .doc
# (tak jest nawet w materiałach COI – formularz 7). Treść i tak jest parsowana według wykrytego typu.
COMPATIBLE_KINDS = {".doc": {"ole", "docx"}}


@dataclass(frozen=True)
class ValidatedUpload:
    filename: str
    ext: str
    kind: str
    data: bytes
    sha256: str

    @property
    def stream(self) -> io.BytesIO:
        return io.BytesIO(self.data)


def validate_filename(name: str | None, settings: Settings) -> tuple[str, str]:
    if not name:
        raise ApiError(422, "Niepoprawna nazwa pliku", "Plik nie ma nazwy.")
    name = unicodedata.normalize("NFC", name)
    if len(name) > 250:
        raise ApiError(422, "Niepoprawna nazwa pliku", "Nazwa pliku może mieć najwyżej 250 znaków.")
    if FORBIDDEN_CHARS.search(name) or CONTROL_CHARS.search(name) or ".." in name:
        raise ApiError(
            422,
            "Niepoprawna nazwa pliku",
            "Nazwa pliku zawiera niedozwolone znaki: ; : > < / \\ | ' * % $ (albo znaki sterujące lub „..”).",
        )
    ext = name[name.rfind(".") :].lower() if "." in name else ""
    if ext not in settings.allowed_extensions or ext not in EXT_KIND:
        allowed = ", ".join(settings.allowed_extensions)
        raise ApiError(415, "Nieobsługiwany format", f"Nieobsługiwany format pliku. Dozwolone: {allowed}.")
    return name, ext


def _zip_kind(data: bytes, max_unzipped: int) -> str | None:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            infos = zf.infolist()
            total = sum(i.file_size for i in infos)
            if total > max_unzipped or len(infos) > 5000:
                raise ApiError(422, "Podejrzany plik", "Plik po rozpakowaniu jest zbyt duży (ochrona przed zip bombą).")
            names = {i.filename for i in infos}
            if "word/document.xml" in names:
                return "docx"
            if "xl/workbook.xml" in names:
                return "xlsx"
            if "mimetype" in names and zf.read("mimetype").strip() == b"application/vnd.oasis.opendocument.spreadsheet":
                return "ods"
    except zipfile.BadZipFile:
        return None
    return None


def detect_kind(data: bytes, max_unzipped: int) -> str | None:
    """Rodzaj pliku wyłącznie po zawartości (magic bytes / struktura kontenera)."""
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"PK\x03\x04"):
        return _zip_kind(data, max_unzipped)
    if olefile.isOleFile(io.BytesIO(data)):
        return "ole"
    kind = filetype.guess(data)
    if kind is None:
        return None
    return {"jpg": "jpeg", "png": "png"}.get(kind.extension)


def validate_upload(filename: str | None, data: bytes, settings: Settings) -> ValidatedUpload:
    name, ext = validate_filename(filename, settings)
    if len(data) > settings.max_upload_bytes:
        raise ApiError(413, "Za duży plik", f"Plik jest większy niż {settings.max_upload_mb} MB.")
    if not data:
        raise ApiError(422, "Pusty plik", "Przesłany plik jest pusty.")
    kind = detect_kind(data, settings.max_unzipped_mb * 1024 * 1024)
    if kind != EXT_KIND[ext] and kind not in COMPATIBLE_KINDS.get(ext, set()):
        raise ApiError(
            415,
            "Niezgodny typ pliku",
            f"Zawartość pliku nie odpowiada rozszerzeniu {ext}. Sprawdź, czy plik nie został przemianowany.",
            detected=kind,
        )
    return ValidatedUpload(name, ext, kind, data, hashlib.sha256(data).hexdigest())
