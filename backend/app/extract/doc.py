import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from app.config import get_settings
from app.errors import ApiError
from app.extract.docx import extract_docx
from app.extract.ir import Document

STYLE_TABLE = {"normalny", "domyślna czcionka akapitu", "normal", "default paragraph font"}
NOISE = re.compile(r"^\"|kształt\d|shape\d|^(times new roman|calibri|arial|symbol|wingdings)\b", re.I)
UTF16_RUN = re.compile(r"[0-9A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż .,;:()\-–/§%„”\"?!☐□]{4,}")


def converter_available() -> bool:
    return shutil.which(get_settings().soffice_cmd) is not None


def _convert(data: bytes) -> bytes:
    settings = get_settings()
    with tempfile.TemporaryDirectory(prefix="ef-doc-") as workdir:
        source = Path(workdir) / "formularz.doc"
        source.write_bytes(data)
        profile = Path(workdir) / "profile"
        try:
            subprocess.run(
                [
                    settings.soffice_cmd,
                    f"-env:UserInstallation=file://{profile}",
                    "--headless",
                    "--norestore",
                    "--convert-to",
                    "docx",
                    "--outdir",
                    workdir,
                    str(source),
                ],
                check=True,
                capture_output=True,
                timeout=settings.converter_timeout_s,
            )
        except (subprocess.SubprocessError, OSError) as exc:
            raise ApiError(422, "Nie udało się przekonwertować pliku DOC.") from exc
        target = Path(workdir) / "formularz.docx"
        if not target.is_file():
            raise ApiError(422, "Nie udało się przekonwertować pliku DOC.")
        return target.read_bytes()


def _fallback(data: bytes) -> Document:
    doc = Document(kind="doc")
    text = data.decode("utf-16-le", errors="ignore")
    for line in re.split(r"[\r\n\x07\x0b\x0c]", text):
        for run in UTF16_RUN.findall(line):
            run = run.strip()
            if run.lower() in STYLE_TABLE:
                doc.warnings.append("Plik DOC odczytano w trybie uproszczonym (bez konwertera LibreOffice).")
                return doc
            if sum(ch.isalpha() for ch in run) >= 3 and not NOISE.search(run):
                doc.add(run)
    doc.warnings.append("Plik DOC odczytano w trybie uproszczonym (bez konwertera LibreOffice).")
    return doc


def extract_doc(data: bytes) -> Document:
    if converter_available():
        doc = extract_docx(_convert(data))
        doc.kind = "doc"
        return doc
    return _fallback(data)
