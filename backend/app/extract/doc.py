"""DOC (Word 97–2003).

1. Jeśli dostępny jest LibreOffice (`soffice`, MPL-2.0, osobny proces) → konwersja DOC→DOCX na tmpfs → extract_docx.
2. W przeciwnym razie własny parser tabeli fragmentów (piece table) z formatu [MS-DOC] na olefile (BSD).
   Bez antiword (GPL). Wystarcza do odczytu tekstu formularzy – formatowanie nie jest potrzebne.
"""

import io
import re
import shutil
import struct
import subprocess
import tempfile
from pathlib import Path

import olefile

from app.config import Settings
from app.errors import ApiError
from app.extract.docx import extract_docx
from app.extract.ir import DocumentIR, append_lines

# znaki specjalne Worda w strumieniu tekstu
_OTHER_CTRL = re.compile(r"[\x00-\x08\x0e-\x1f]")
_WORD_CTRL = {"\r": "\n", "\x0b": "\n", "\x0c": "\n", "\x07": "\n", "\x13": "", "\x14": "", "\x15": "", "\x01": ""}


def _soffice_convert(data: bytes, settings: Settings) -> bytes | None:
    binary = shutil.which(settings.soffice_bin)
    if not binary:
        return None
    with tempfile.TemporaryDirectory(prefix="coi-doc-") as tmp:
        src = Path(tmp) / "input.doc"
        src.write_bytes(data)
        try:
            subprocess.run(
                [binary, "--headless", "--norestore", "--convert-to", "docx", "--outdir", tmp, str(src)],
                check=True,
                capture_output=True,
                timeout=60,
                env={"HOME": tmp, "PATH": "/usr/bin:/bin"},
            )
        except (subprocess.SubprocessError, OSError):
            return None
        out = Path(tmp) / "input.docx"
        return out.read_bytes() if out.exists() else None


def _piece_table_text(data: bytes) -> str:
    ole = olefile.OleFileIO(io.BytesIO(data))
    word = ole.openstream("WordDocument").read()
    flags = struct.unpack_from("<H", word, 0x000A)[0]
    if flags & 0x0100:  # fEncrypted
        raise ApiError(422, "Zaszyfrowany dokument", "Dokument DOC jest zabezpieczony hasłem.")
    table_name = "1Table" if flags & 0x0200 else "0Table"
    table = ole.openstream(table_name).read()

    # FibRgFcLcb97: fcClx / lcbClx (offset liczony od początku FIB)
    csw = struct.unpack_from("<H", word, 32)[0]
    rglw_start = 34 + csw * 2
    cslw = struct.unpack_from("<H", word, rglw_start)[0]
    fclcb_start = rglw_start + 2 + cslw * 4 + 2
    fc_clx, lcb_clx = struct.unpack_from("<II", word, fclcb_start + 66 * 4)
    clx = table[fc_clx : fc_clx + lcb_clx]

    pos = 0
    while pos < len(clx) and clx[pos] == 0x01:  # Prc (formatowanie) – pomijamy
        pos += 3 + struct.unpack_from("<H", clx, pos + 1)[0]
    if pos >= len(clx) or clx[pos] != 0x02:
        raise ValueError("brak Pcdt w CLX")
    lcb = struct.unpack_from("<I", clx, pos + 1)[0]
    plc = clx[pos + 5 : pos + 5 + lcb]
    n = (lcb - 4) // 12
    cps = struct.unpack_from(f"<{n + 1}I", plc, 0)
    parts: list[str] = []
    for i in range(n):
        pcd = plc[(n + 1) * 4 + i * 8 : (n + 1) * 4 + (i + 1) * 8]
        fc = struct.unpack_from("<I", pcd, 2)[0]
        length = cps[i + 1] - cps[i]
        if fc & 0x40000000:  # fCompressed → cp1252
            start = (fc & ~0x40000000) // 2
            parts.append(word[start : start + length].decode("cp1252", errors="replace"))
        else:
            parts.append(word[fc : fc + length * 2].decode("utf-16-le", errors="replace"))
    text = "".join(parts)
    for k, v in _WORD_CTRL.items():
        text = text.replace(k, v)
    # pozostałe znaki sterujące (np. \x08 – kotwice obiektów rysunkowych / pól tekstowych)
    return _OTHER_CTRL.sub("", text)


def extract_doc(data: bytes, settings: Settings) -> DocumentIR:
    converted = _soffice_convert(data, settings)
    if converted:
        ir = extract_docx(converted)
        ir.source_format = "doc"
        return ir
    ir = DocumentIR("doc")
    try:
        text = _piece_table_text(data)
    except ApiError:
        raise
    except Exception as e:
        raise ApiError(422, "Nie udało się odczytać DOC", f"Nie można odczytać pliku DOC ({e}).") from e
    append_lines(ir, text.splitlines())
    return ir
