"""DocumentIR – wspólna reprezentacja dokumentu po ekstrakcji, niezależna od formatu."""

import re
from dataclasses import dataclass, field

CHECKBOX_CHARS = "☐□■☑☒✓✗✔✘❑❒◻◽▢"
# + znaki z prywatnego zakresu Unicode (czcionki Wingdings/Symbol w PDF/DOC: \uf0a8, \uf0f0, \uf06f…)
_CHECKBOX_RE = re.compile(f"^[{CHECKBOX_CHARS}\\uf020-\\uf0ff]\\s*")
_SPACES = re.compile(r"[ \t ]+")


@dataclass
class Block:
    text: str
    page: int = 1
    kind: str = "text"  # heading | label | checkbox | text | table_cell
    confidence: float = 1.0  # pewność OCR (1.0 dla tekstu z warstwy dokumentu)


@dataclass
class DocumentIR:
    source_format: str
    blocks: list[Block] = field(default_factory=list)
    pages: int = 1
    ocr_used: bool = False

    @property
    def text(self) -> str:
        return "\n".join(b.text for b in self.blocks)


def clean_line(text: str) -> str:
    return _SPACES.sub(" ", text.replace("​", "")).strip()


def make_block(text: str, page: int = 1, confidence: float = 1.0) -> Block | None:
    t = clean_line(text)
    if not t:
        return None
    kind = "text"
    if _CHECKBOX_RE.match(t):
        kind = "checkbox"
        t = _CHECKBOX_RE.sub("", t).strip()
        if not t:
            return None
    return Block(t, page, kind, confidence)


def append_lines(ir: DocumentIR, lines: list[str], page: int = 1, confidence: float = 1.0) -> None:
    for line in lines:
        b = make_block(line, page, confidence)
        if b is not None and (not ir.blocks or ir.blocks[-1].text != b.text):
            ir.blocks.append(b)
