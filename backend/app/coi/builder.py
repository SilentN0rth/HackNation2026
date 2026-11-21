"""[4] Builder COI: bloki standardowe + strony „Przedmiot wniosku” z FormIR.

Kolejność stron: Dane → Przedmiot wniosku (1..n) → Kontakt i zgody → Strona końcowa.
Builder jest deterministyczny – ten sam FormIR daje ten sam JSON (UUID z uuid5 po ziarnie).
"""

import copy
import json
import re
import unicodedata
import uuid
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Any

from app.coi.jsonata import show_query
from app.coi.models import DICTIONARY_TYPES, FieldType
from app.understand.form_ir import ConditionIR, FieldIR, FormIR

BLOCKS_DIR = Path(__file__).parent / "blocks"
STANDARD_TABS = ("dane", "kontakt", "finish")
MAX_TECHNAME = 60
_PL = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")


@cache
def _block(name: str) -> dict[str, Any]:
    return json.loads((BLOCKS_DIR / f"{name}.json").read_text())


def slugify(text: str, max_len: int = MAX_TECHNAME) -> str:
    t = text.translate(_PL)
    t = unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "_", t).strip("_").lower()
    t = t[:max_len].rstrip("_")
    if not t or t[0].isdigit():
        t = f"pole_{t}" if t else "pole"
    return t


def _walk(tab: dict[str, Any]):
    for q in tab["questions"]:
        yield q["field"]
        for c in q["field"].get("repeatingSectionGrid") or []:
            yield c["field"]


@dataclass
class BuildResult:
    coi: dict[str, Any]
    # techName → {legalBasis, confidence, source, needsReview, key} – nasze rozszerzenia, NIE trafiają do eksportu COI
    meta: dict[str, dict[str, Any]] = field(default_factory=dict)


class _Ids:
    """Deterministyczne UUID: uuid5(NAMESPACE, ziarno/licznik)."""

    def __init__(self, seed: str) -> None:
        self.ns = uuid.uuid5(uuid.NAMESPACE_URL, f"coi-form:{seed}")
        self.n = 0

    def __call__(self) -> str:
        self.n += 1
        return str(uuid.uuid5(self.ns, str(self.n)))


class _TechNames:
    def __init__(self) -> None:
        self.used: set[str] = set()

    def reserve(self, name: str) -> None:
        self.used.add(name)

    def make(self, label: str) -> str:
        base = slugify(label)
        name, i = base, 2
        while name in self.used:
            suffix = f"_{i}"
            name = f"{base[: MAX_TECHNAME - len(suffix)]}{suffix}"
            i += 1
        self.used.add(name)
        return name


def _html(text: str) -> str:
    if not text:
        return ""
    esc = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"<html><head></head><body><p>{esc}</p></body></html>"


def _field_obj(f: FieldIR, tech: str, fid: str, order: int, names: _TechNames) -> dict[str, Any]:
    validation = ["REQUIRED"] if f.required and f.type not in {FieldType.TEXT_BLOCK, FieldType.INFO_SECTION} else []
    validation += [v for v in f.validators if v not in validation]
    obj: dict[str, Any] = {
        "id": fid,
        "type": str(f.type),
        "techName": tech,
        "title": f.label,
        "description": _html(f.description),
        "options": [],
        "validation": validation,
        "readOnly": False,
        "repeatingSectionGrid": [],
        "states": [],
        "questionOrder": order,
        "tooltipMessage": "",
    }
    if f.type in DICTIONARY_TYPES and f.dictionary:
        obj["dictionaryName"] = f.dictionary
    elif f.type in DICTIONARY_TYPES:
        opt_names = _TechNames()
        obj["options"] = [{"id": o, "name": o, "techName": opt_names.make(o)} for o in f.options]
    if f.type == FieldType.SELECT:
        obj["searchEnabled"] = len(f.options) > 10
    if f.legal_basis:
        obj["tooltipMessage"] = f"Pytamy, bo: {f.legal_basis.unit} – {f.legal_basis.act}"[:500]
    return obj


def build_coi(form: FormIR, seed: str | None = None) -> BuildResult:
    ids = _Ids(seed or form.title)
    names = _TechNames()
    meta: dict[str, dict[str, Any]] = {}

    std = {k: copy.deepcopy(_block(k)) for k in STANDARD_TABS}
    for tab in std.values():
        for f in _walk(tab):
            names.reserve(f["techName"])
    # nazwa urzędu w bloku „Dane” (pole tylko do odczytu)
    if form.office:
        for f in _walk(std["dane"]):
            if f["techName"] == "nazwa_urzedu":
                f["defaultValue"] = form.office

    reserved_titles = {std[k]["title"] for k in STANDARD_TABS}
    subject_tabs: list[dict[str, Any]] = []
    # klucz pola z FormIR → (tytuł strony, techName sekcji, techName pola, obiekt pola)
    where: dict[str, tuple[str, str, str, dict[str, Any]]] = {}
    pending: list[tuple[dict[str, Any], ConditionIR]] = []
    used_titles = set(reserved_titles)

    pages = [p for p in form.pages if any(s.fields for s in p.sections)]
    if not pages:
        from app.understand.form_ir import PageIR, SectionIR

        pages = [PageIR("Przedmiot wniosku", [SectionIR("Treść wniosku", [
            FieldIR("tresc", "Opisz, czego dotyczy wniosek", FieldType.TEXTAREA, needs_review=True,
                    confidence=0.0, source="(nie rozpoznano pól – pole zastępcze)")])])]

    for page in pages:
        title, i = page.title.strip() or "Przedmiot wniosku", 2
        while title in used_titles:
            title = f"{page.title} ({i})"
            i += 1
        used_titles.add(title)
        tab = {"id": ids(), "title": title, "type": "MAIN", "questions": []}
        y = 0
        for section in (s for s in page.sections if s.fields):
            sec_tech = names.make(section.title)
            children = []
            for order, f in enumerate(section.fields):
                tech = names.make(f.label)
                obj = _field_obj(f, tech, ids(), order, names)
                children.append({"x": 0, "y": order, "rows": 1, "cols": 3, "field": obj})
                where[f.key] = (title, sec_tech, tech, obj)
                if f.condition:
                    pending.append((obj, f.condition))
                meta[tech] = {
                    "key": f.key,
                    "confidence": f.confidence,
                    "source": f.source,
                    "needsReview": f.needs_review,
                    "legalBasis": None
                    if not f.legal_basis
                    else {
                        "act": f.legal_basis.act,
                        "unit": f.legal_basis.unit,
                        "quote": f.legal_basis.quote,
                        "chunkId": f.legal_basis.chunk_id,
                    },
                }
            sec_obj = {
                "id": ids(),
                "type": "SECTION",
                "techName": sec_tech,
                "title": section.title,
                "description": "",
                "options": [],
                "validation": [],
                "readOnly": False,
                "repeatingSectionGrid": children,
                "states": [],
                "questionOrder": y,  # jak we wzorcach COI: kolejność sekcji = jej y w siatce
                "tooltipMessage": "",
            }
            if section.condition:
                pending.append((sec_obj, section.condition))
            rows = max(2, len(children) + 1)
            tab["questions"].append({"x": 0, "y": y, "rows": rows, "cols": 3, "field": sec_obj})
            y += rows
        subject_tabs.append(tab)

    # warunki SHOW – dopiero gdy znamy techName wszystkich pól
    for obj, cond in pending:
        target = where.get(cond.field_key)
        if target is None:
            continue
        tab_title, sec_tech, field_tech, _ = target
        obj["states"].append({"type": "SHOW", "query": show_query(cond.equals, tab_title, sec_tech, field_tech,
                                                                  cond.negate)})

    tabs = [std["dane"], *subject_tabs, std["kontakt"], std["finish"]]
    # nowe UUID dla bloków standardowych (warunki odwołują się do tytułów/techName, nie do id)
    for tab in (std["dane"], std["kontakt"], std["finish"]):
        tab["id"] = ids()
        for f in _walk(tab):
            f["id"] = ids()
    links = [{"id": ids(), "source": a["id"], "target": b["id"]} for a, b in zip(tabs, tabs[1:], strict=False)]
    coi = {"title": form.title[:255], "tabs": tabs, "flow": {"links": links}}
    return BuildResult(coi, meta)
