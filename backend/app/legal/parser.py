"""Parser tekstu ustawy → fragmenty (art. / ust. / pkt) z `chunkId` i `unit`.

Format pliku w data/statutes/*.txt (tekst jednolity z ISAP/ELI, pobrany PRZED demo – bez API na żywo):
    pierwsza linia: pełny tytuł aktu, np. „Ustawa z dnia 16 listopada 2006 r. o opłacie skarbowej”
    dalej: tekst aktu w oryginalnym brzmieniu.
Jednostka redakcyjna pochodzi z PARSERA, nigdy z LLM.
"""

import re
from dataclasses import dataclass
from pathlib import Path

ART = re.compile(r"^\s*Art\.\s*(\d+[a-z]*)\.?\s*(.*)$")
UST = re.compile(r"^\s*(\d+[a-z]*)\.\s+(.*)$")
PKT = re.compile(r"^\s*(\d+[a-z]*)\)\s+(.*)$")


@dataclass(frozen=True)
class StatuteChunk:
    id: str
    act: str
    unit: str
    text: str


def _slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower())[:40].strip("-")


def parse_statute(text: str, act_id: str) -> list[StatuteChunk]:
    lines = [ln.rstrip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln.strip()]
    if not lines:
        return []
    act = lines[0].strip()
    chunks: list[StatuteChunk] = []
    art = ust = pkt = None
    buf: list[str] = []

    def flush() -> None:
        if art and buf:
            unit = f"art. {art}" + (f" ust. {ust}" if ust else "") + (f" pkt {pkt}" if pkt else "")
            cid = f"{act_id}:{_slug(unit)}"
            chunks.append(StatuteChunk(cid, act, unit, " ".join(buf).strip()))
        buf.clear()

    for line in lines[1:]:
        if m := ART.match(line):
            flush()
            art, ust, pkt = m[1], None, None
            rest = m[2]
            if (u := UST.match(rest)) is not None:
                ust, rest = u[1], u[2]
            if rest:
                buf.append(rest)
        elif art and (m := UST.match(line)):
            flush()
            ust, pkt = m[1], None
            buf.append(m[2])
        elif art and (m := PKT.match(line)):
            flush()
            pkt = m[1]
            buf.append(m[2])
        elif art:
            buf.append(line.strip())
    flush()
    return chunks


def load_corpus(directory: Path) -> list[StatuteChunk]:
    chunks: list[StatuteChunk] = []
    for path in sorted(directory.glob("*.txt")):
        chunks.extend(parse_statute(path.read_text(encoding="utf-8"), path.stem))
    return chunks
