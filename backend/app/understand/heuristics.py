"""[3a] Heurystyki: DocumentIR → FormIR bez LLM (tryb awaryjny i baza dla LLM).

Obsługuje dwa style starych druków:
  • tabelaryczny – numerowane nagłówki („2.1. Dane identyfikacyjne”) i etykiety w osobnych liniach,
  • „do wykropkowania” – pole to ciąg kropek, a etykieta stoi przed kropkami albo w podpowiedzi
    „(imię i nazwisko)” / „/ podpis /” pod nimi; w jednej linii może być kilka pól.

Rozpoznane dane wnioskodawcy (imię, PESEL, adres, kontakt) NIE trafiają do „Przedmiotu wniosku” –
zastępuje je standardowy blok COI („Dane”, „Kontakt i zgody”).
"""

import re
from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Any

import yaml
from rapidfuzz import fuzz

from app.coi.models import FieldType
from app.extract.ir import Block, DocumentIR
from app.understand.form_ir import ConditionIR, FieldIR, FormIR, PageIR, SectionIR

CATALOG_PATH = Path(__file__).parent / "field_catalog.yaml"

FILL = re.compile(r"(?:\s*[.…_]){3,}\s*|\s*…+\s*")
HEADING = re.compile(r"^(?P<num>(?:\d{1,2}\.)+\d{0,2}|[IVX]{1,5}\.)\s*(?P<title>\S.*)$")
SUBITEM = re.compile(r"^(?:[a-z][/)]|\d{1,2}\)|[-–•])\s*(?P<text>.*)$")
HINT = re.compile(r"^\s*[(/]\s*(?P<text>[^()]*?)\s*[)/]\s*$")
TITLE_START = re.compile(
    r"^(?:[IVX]{1,4}\.\s*)?(wniosek|deklaracja|zgłoszenie|zgloszenie|podanie|oświadczenie|informacja|"
    r"zawiadomienie|wystąpienie)\b",
    re.I,
)
OFFICE = re.compile(
    r"^(urząd|urzad|starost|prezydent|wójt|wojt|burmistrz|marszałek|rada (miasta|gminy)|gmina|miasto|"
    r"wydział|zarząd)", re.I
)
OFFICE_ANY = re.compile(
    r"(?:^|\s)(urząd|urzad|starost|prezydent|wójt|wojt|burmistrz|marszałek|rada (miasta|gminy)|wydział|zarząd)",
    re.I,
)
CHOICE_HINT = re.compile(r"postaw\s*[„\"]?x|zaznacz|wybierz|właściwe zakreślić|odpowiednie zaznaczyć", re.I)
MULTI_HINT = re.compile(r"można zaznaczyć (kilka|więcej)|wielokrotn", re.I)
OPTIONAL_HINT = re.compile(r"nie są obowiązkow|nieobowiązkow|opcjonaln|jeśli dotyczy|jeżeli dotyczy", re.I)
CONDITION_HINT = re.compile(r"^(jeśli|jeżeli|w przypadku)\b.*(wybier|zaznacz|wskaż)", re.I)
STATEMENT = re.compile(r"\boświadczam\b|\bjednocześnie oświadczam\b", re.I)
RODO = re.compile(
    r"\brodo\b|klauzula informacyjna|art\.\s*13\b.*rozporządzenia|administratorem\b.*danych|"
    r"wyrażam zgodę na przetwarzanie",
    re.I,
)
LEGAL_LINE = re.compile(r"^(art\.|§)\s*\d+.*(ustaw|rozporządz|kodeks)", re.I)
REQUEST = re.compile(r"^(proszę|wnoszę)\s+o\s+", re.I)
TRAILING_PREP = re.compile(r"\s+(w|o|na|do|z|od|dla|przy|we)\s*$", re.I)
UNIT_SUFFIX = re.compile(r"^(m2|m²|m|km|zł|pln|dni|szt\.?|osób|h|godz\.?)$", re.I)
ROMAN = re.compile(r"^[IVX]+\.$")
SHORT_PHRASE = 4
LABEL_MAX_WORDS = 12
PROSE_MIN_WORDS = 10
INLINE_BOX = re.compile(r"\s*[☐□❑❒◻◽▢\uf06f\uf0a8]\s*")
FOOTNOTE_REF = re.compile(r"\s*(\d)\s?\)$")  # „Przy ulicy1)” – odwołanie do przypisu
FOOTNOTE_DEF = re.compile(r"^(\d)\s?\)\s*(?P<text>.+)$")  # „1) Dane nieobowiązkowe”


@dataclass
class CatalogEntry:
    match: list[str]
    title: str | None = None
    type: FieldType | None = None
    validation: list[str] = field(default_factory=list)
    group: str | None = None
    dictionary: str | None = None


@dataclass
class Catalog:
    fields: list[CatalogEntry]
    applicant_sections: list[str]
    skip_sections: list[str]
    legal_sections: list[str]
    attachment_sections: list[str]
    drop_lines: list[str]


@cache
def load_catalog(path: Path = CATALOG_PATH) -> Catalog:
    raw: dict[str, Any] = yaml.safe_load(path.read_text())
    entries = [
        CatalogEntry(
            match=[norm(m) for m in e["match"]],
            title=e.get("title"),
            type=FieldType(e["type"]) if e.get("type") else None,
            validation=e.get("validation", []),
            group=e.get("group"),
            dictionary=e.get("dictionary"),
        )
        for e in raw["fields"]
    ]
    return Catalog(
        entries,
        *(
            [norm(x) for x in raw.get(k, [])]
            for k in ("applicant_sections", "skip_sections", "legal_sections", "attachment_sections", "drop_lines")
        ),
    )


def norm(text: str) -> str:
    t = text.lower().replace("*", " ")
    t = re.sub(r"[.:;,()\[\]/\\\"„”'`]+", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def _phrase_in(phrase: str, text: str) -> bool:
    if len(phrase) <= SHORT_PHRASE:
        return re.search(rf"(^|\s){re.escape(phrase)}(\s|$)", text) is not None
    if phrase in text:
        return True
    return len(text) >= len(phrase) - 2 and fuzz.partial_ratio(phrase, text) >= 92


def match_entry(label: str, catalog: Catalog) -> CatalogEntry | None:
    t = norm(label)
    if not t:
        return None
    for e in catalog.fields:
        if any(_phrase_in(p, t) for p in e.match):
            return e
    return None


def _any_phrase(text: str, phrases: list[str]) -> bool:
    t = norm(text)
    return any(_phrase_in(p, t) for p in phrases)


def _clean_label(text: str) -> tuple[str, str]:
    """Etykieta bez numeracji, gwiazdek i dwukropka; treść nawiasów → opis."""
    t = re.sub(r"^\s*(?:\d{1,2}[.)]|[a-z][/)]|[-–•])\s*", "", text).strip()
    desc_parts = re.findall(r"\(([^()]*)\)", t)
    t = re.sub(r"\([^()]*\)", " ", t)
    if "(" in t:  # niedomknięty nawias – reszta to instrukcja
        t, rest = t.split("(", 1)
        desc_parts.append(rest)
    t = re.sub(r"[*`☐□❑❒◻◽▢\uf06f\uf0a8]+", " ", t)
    t = re.sub(r"\s+", " ", t).strip(" :;,-–.")
    if t.isupper() and len(t) > 3:
        t = t.capitalize()
    if t:
        t = t[0].upper() + t[1:]
    return t, "; ".join(d.strip() for d in desc_parts if d.strip())


def _nice_case(text: str) -> str:
    """„WÓJT GMINY PŁOSKINIA” → „Wójt Gminy Płoskinia”; inne teksty bez zmian."""
    if text.isupper():
        small = {"i", "w", "o", "z", "na", "do", "ul.", "dla"}
        return " ".join(w.lower() if w.lower() in small and k else w.capitalize() for k, w in enumerate(text.split()))
    return text


def _words(text: str) -> int:
    return len(text.split())


# ---------------------------------------------------------------------------------------------


@dataclass
class _Section:
    title: str
    kind: str = "normal"  # normal | applicant | skip | legal | attach | header
    description: str = ""
    fields: list[FieldIR] = field(default_factory=list)
    choice: bool = False
    multi: bool = False
    optional: bool = False
    page_break: bool = False
    condition_option: str | None = None  # po „Jeśli wybierzesz…” kolejne pola zależą od tej opcji
    choice_field: FieldIR | None = None


class _Builder:
    def __init__(self, catalog: Catalog) -> None:
        self.c = catalog
        self.sections: list[_Section] = []
        self.n = 0
        self.pending_unlabeled: list[FieldIR] = []
        self.sub_context: str | None = None
        self.statement: FieldIR | None = None
        self.carry = ""
        self.footnotes: dict[str, list[FieldIR]] = {}
        self.last_top = 0
        self.legal: list[str] = []
        self.groups: set[str] = set()

    @property
    def cur(self) -> _Section:
        return self.sections[-1]

    def key(self) -> str:
        self.n += 1
        return f"f{self.n}"

    def open_section(self, raw_title: str, page_break: bool = False, header: bool = False) -> None:
        title, desc = _clean_label(raw_title)
        kind = "header" if header else "normal"
        if not header:
            if _any_phrase(raw_title, self.c.skip_sections) or RODO.search(raw_title):
                kind = "skip"
            elif _any_phrase(raw_title, self.c.legal_sections):
                kind = "legal"
            elif _any_phrase(raw_title, self.c.attachment_sections):
                kind = "attach"
            elif _any_phrase(title, self.c.applicant_sections):
                kind = "applicant"
        s = _Section(title or "Informacje", kind, desc, page_break=page_break)
        s.choice = bool(CHOICE_HINT.search(raw_title)) and kind == "normal"
        s.multi = bool(MULTI_HINT.search(raw_title))
        if STATEMENT.search(raw_title) and kind == "normal":
            s.title = "Oświadczenia"
        s.optional = bool(OPTIONAL_HINT.search(raw_title))
        self.sections.append(s)
        self.pending_unlabeled = []
        self.sub_context = None
        self.statement = None
        self.carry = ""
        if STATEMENT.search(raw_title) and kind == "normal":
            self.statement = self.add_field("Oświadczam, że", Block(raw_title), ftype=FieldType.CHECKBOX)

    def add_field(self, label: str, block: Block, description: str = "", ftype: FieldType | None = None) -> FieldIR:
        marker = FOOTNOTE_REF.search(label)
        if marker:
            label = label[: marker.start()]
        clean, desc2 = _clean_label(label)
        if self.sub_context and clean and _words(clean) <= 2:
            clean = f"{self.sub_context} – {clean.lower()}"
        f = FieldIR(
            key=self.key(),
            label=clean,
            description=description or desc2,
            confidence=block.confidence,
            source=block.text[:200],
            needs_review=block.confidence < 0.75,
        )
        if ftype:
            f.type = ftype
        s = self.cur
        if s.optional or s.kind == "attach":
            f.required = False
        if s.condition_option and s.choice_field:
            f.condition = ConditionIR(s.choice_field.key, s.condition_option)
        s.fields.append(f)
        if marker:
            self.footnotes.setdefault(marker.group(1), []).append(f)
        return f

    # --- obsługa linii ---

    def handle(self, block: Block) -> None:
        text = block.text
        s = self.cur

        if s.kind == "skip":
            return
        if RODO.search(text):
            self.open_section("Klauzula informacyjna RODO")
            self.cur.kind = "skip"
            return
        fdef = FOOTNOTE_DEF.match(text)
        if fdef and fdef.group(1) in self.footnotes and not FILL.search(text):
            if OPTIONAL_HINT.search(fdef["text"]):
                for f in self.footnotes[fdef.group(1)]:
                    f.required = False
            return
        if re.fullmatch(r"\d\s?\)", text):
            return  # samotny znacznik przypisu
        if REQUEST.match(text) and not FILL.search(text):
            return  # „Wnoszę o …” bez miejsca do wpisania – wstęp, nie pole

        if s.kind == "legal" or LEGAL_LINE.match(text):
            self.legal.append(text)
            if s.kind == "legal":
                return

        if self.statement is not None:
            m = SUBITEM.match(text)
            if m:
                self.statement.options.append(_clean_label(m["text"])[0])
                return
            if self.statement.options and not FILL.search(text) and not HEADING.match(text):
                self.statement.options[-1] += f" {text}"  # kontynuacja punktu
                return
            self.statement = None

        if STATEMENT.search(text) and not FILL.search(text):
            label = text.split(",")[0] if _words(text) > LABEL_MAX_WORDS else text
            self.statement = self.add_field("Oświadczenia", block, description=_clean_label(label)[0],
                                            ftype=FieldType.CHECKBOX)
            return

        hint = HINT.match(text)
        if hint:
            htext = hint["text"]
            if self.pending_unlabeled:
                f = self.pending_unlabeled.pop(0)
                f.label, f.description = _clean_label(htext)[0], f.description
                return
            if s.fields and not s.fields[-1].description:
                s.fields[-1].description = _clean_label(htext)[0]
            return

        if s.kind == "attach":
            label, _ = _clean_label(text)
            if label and not FILL.fullmatch(text):
                if s.fields and text[:1].islower():  # kontynuacja poprzedniej pozycji
                    s.fields[-1].label += f" {text}"
                else:
                    self.add_field(label, block, ftype=FieldType.FILE_UPLOADER)
            return

        inline = INLINE_BOX.split(text)
        if len(inline) >= 3 and not FILL.search(text):
            # „Płeć: ❑ pies ❑ suka” – pytanie z opcjami w jednej linii
            label, options = inline[0].strip(" :"), [o.strip(" ,;") for o in inline[1:] if o.strip(" ,;")]
            if label and len(options) >= 2:
                f = self.add_field(label, block, ftype=FieldType.RADIO)
                f.options = [_clean_label(o)[0] for o in options]
                return

        if FILL.search(text):
            self._fill_line(block)
            return

        if block.kind == "checkbox" or (s.choice and _words(text) <= LABEL_MAX_WORDS and not CONDITION_HINT.match(text)
                                        and s.condition_option is None):
            self._option(text, block)
            return

        if CONDITION_HINT.match(text):
            if s.choice_field and s.choice_field.options:
                s.condition_option = s.choice_field.options[-1]
            return

        sub = SUBITEM.match(text)
        if sub and _words(text) <= LABEL_MAX_WORDS and not text.rstrip().endswith("."):
            ctx = re.sub(r"\s+", " ", sub["text"]).strip(" :")
            self.sub_context = ctx[0].upper() + ctx[1:] if ctx else None
            return

        if text[:1].islower() and not self.pending_unlabeled:
            self.carry = f"{self.carry} {text}".strip()  # początek zdania, które kończy się polem w kolejnej linii
            return

        if _words(text) <= 1 and len(text) <= 3:
            return  # śmieci z warstwy tekstu (fragmenty pieczątek, pojedyncze litery)

        if self.pending_unlabeled and _words(text) <= LABEL_MAX_WORDS:
            f = self.pending_unlabeled.pop(0)
            f.label = _clean_label(text)[0]
            return

        if _words(text) >= PROSE_MIN_WORDS or text.rstrip().endswith(".") and _words(text) > 6:
            return  # proza (pouczenia, wstęp) – nie jest polem
        self.add_field(text, block)

    def _fill_line(self, block: Block) -> None:
        segments = FILL.split(block.text)
        segments[0] = REQUEST.sub("", segments[0]).strip()
        if self.carry:
            segments[0] = f"{self.carry} {segments[0]}".strip()
            self.carry = ""
        if _words(segments[0]) >= 3:
            self.sub_context = None  # nowe zdanie – koniec wyliczenia „a/ … b/ …”
        new: list[FieldIR] = []
        for i, seg in enumerate(segments[:-1]):
            label = seg.strip()
            if _words(label) >= 3:
                label = TRAILING_PREP.sub("", label)
            f = self.add_field(label, block)
            new.append(f)
            if not f.label:
                self.pending_unlabeled.append(f)
            elif _words(f.label) > LABEL_MAX_WORDS and i == 0:
                f.needs_review = True
        tail = segments[-1].strip(" .,")
        if new and tail:
            first = tail.split()[0].strip(",.")
            if UNIT_SUFFIX.match(first):
                new[-1].label = f"{new[-1].label} ({first})" if new[-1].label else first
                new[-1].type = FieldType.NUMBER

    def _option(self, text: str, block: Block) -> None:
        s = self.cur
        label, _ = _clean_label(text)
        if not label:
            return
        if s.choice_field is None:
            # pole wyboru: etykietą jest poprzednie „gołe” pole albo tytuł sekcji
            prev = s.fields[-1] if s.fields and not s.fields[-1].options and block.kind == "checkbox" else None
            if prev is not None:
                prev.label = TRAILING_PREP.sub("", REQUEST.sub("", prev.label)).strip()
                prev.label = prev.label[:1].upper() + prev.label[1:]
            if prev is not None and prev.type == FieldType.TEXT_FIELD and _words(prev.label) <= LABEL_MAX_WORDS:
                s.choice_field = prev
            else:
                s.choice_field = self.add_field(s.title, block)
            s.choice_field.type = FieldType.CHECKBOX if s.multi else FieldType.RADIO
        s.choice_field.options.append(label)

    # --- wynik ---

    def finish(self, title: str, office: str | None) -> FormIR:
        pages: list[PageIR] = []
        page: PageIR | None = None
        for s in self.sections:
            fields = self._finalize_fields(s)
            if s.kind in {"skip", "legal"}:
                continue
            if s.kind == "header":
                continue  # dane z nagłówka pisma pokrywają bloki standardowe „Dane” i „Kontakt”
            if s.kind == "applicant":
                fields = [f for f in fields if self._group(f) not in {"applicant", "address", "contact"}]
            if not fields:
                continue
            if s.kind in {"applicant"} and all(f.type == FieldType.TEXT_FIELD for f in fields) and len(fields) <= 2:
                continue  # resztki danych wnioskodawcy – blok standardowy je pokrywa
            section_title = s.title if s.kind != "header" else "Informacje podstawowe"
            if page is None or s.page_break or len(page.sections) >= 4:
                page = PageIR(_page_title(section_title, s))
                pages.append(page)
            page.sections.append(SectionIR(section_title, fields))
        ir = FormIR(title=title, office=office, pages=pages, legal_basis_text=self.legal,
                    standard_blocks=sorted(self.groups))
        return ir

    def _group(self, f: FieldIR) -> str | None:
        e = match_entry(f.label, self.c)
        return e.group if e else None

    def _finalize_fields(self, s: _Section) -> list[FieldIR]:
        out: list[FieldIR] = []
        for f in s.fields:
            if not f.label:
                f.label = s.title if len(s.fields) == 1 else "Uzupełnij"
                f.needs_review = True
            if not re.search(r"[a-ząćęłńóśźż]{2}", f.label, re.I):
                continue  # resztki przypisów / numeracji („2)”)
            e = match_entry(f.label, self.c)
            if e and e.group == "signature":
                continue
            if e and e.group in {"applicant", "address", "contact"}:
                self.groups.add(e.group)
                if s.kind in {"applicant", "header"}:
                    out.append(f)
                    continue
            if e:
                if e.type and f.type == FieldType.TEXT_FIELD:
                    f.type = e.type
                f.validators = [v for v in e.validation if v not in f.validators] + f.validators
                if e.title and _words(f.label) <= 4:
                    f.label = e.title
                if e.dictionary:
                    f.dictionary = e.dictionary
            if f.type == FieldType.FILE_UPLOADER:
                f.required = False
            if f.type in {FieldType.RADIO, FieldType.CHECKBOX} and not f.options:
                f.type = FieldType.CHECKBOX
                f.options = [f.label]
            out.append(f)
        # sekcja bez pól, ale z poleceniem „opisz…” → pole tekstowe długie
        if not out and s.kind == "normal" and (re.search(r"opisz|uzasadni", s.title + s.description, re.I)):
            out.append(FieldIR(self.key(), s.title, FieldType.TEXTAREA, description=s.description,
                               source=s.title))
        return out


def _page_title(section_title: str, s: _Section) -> str:
    t = section_title
    return t if len(t) <= 60 else t[:57].rsplit(" ", 1)[0] + "…"


def _body_title(title: str) -> str:
    """Tytuł sekcji dla treści bez numerowanych nagłówków: „Wniosek o wydanie X” → „Wydanie X”."""
    m = re.match(r"^\S+\s+o\s+(.*)$", title)
    t = m.group(1) if m else "Przedmiot wniosku"
    t = t[0].upper() + t[1:]
    return t if len(t) <= 60 else "Przedmiot wniosku"


def _detect_header(blocks: list[Block]) -> tuple[int, int, str, str | None]:
    """Indeks pierwszej i ostatniej linii tytułu, tytuł i nazwa urzędu."""
    title_idx, title_end, title = -1, -1, ""
    for i, b in enumerate(blocks[:60]):
        t = b.text.strip()
        if TITLE_START.match(t) and _words(t) <= 30 and not FILL.search(t):
            title_idx = i
            title = re.sub(r"^[IVX]{1,4}\.\s*", "", t)
            j = i + 1
            # „WNIOSEK” / „o wydanie zezwolenia …” w kilku liniach
            while j < len(blocks) and j <= i + 3 and _words(title) <= 25:
                nxt = blocks[j].text.strip()
                if FILL.search(nxt) or HEADING.match(nxt) or HINT.match(nxt) or REQUEST.match(nxt):
                    break
                if _words(title) == 1 or (nxt[:1].islower() and _words(title) <= 3):
                    title = f"{title} {nxt}"
                    j += 1
                    continue
                break
            title_end = j - 1
            break
    title = re.sub(r"\s*\*+", "", title).strip()
    first, _, rest = title.partition(" ")
    if first.isupper():
        title = (first.capitalize() + " " + rest).strip()
    first, _, rest = title.partition(" ")
    if rest.isupper():
        title = f"{first} {rest.lower()}"
    if title.isupper():
        title = title.capitalize()
    title = re.sub(r"\s+", " ", title)
    office = None
    search = blocks[: (title_idx + 6 if title_idx >= 0 else 15)]
    for k, b in enumerate(search):
        t = b.text.strip()
        m_off = OFFICE_ANY.search(t)
        if m_off and not FILL.search(t) and not TITLE_START.match(t):
            t = t[m_off.start():].strip()
            if _words(t) > 10:
                continue
            office = t
            nxt = search[k + 1].text.strip() if k + 1 < len(search) else ""
            if (_words(t) <= 4 and nxt and _words(nxt) <= 2 and not re.search(r"\d", nxt)
                    and not TITLE_START.match(nxt) and not OFFICE.match(nxt)):
                office = f"{t} {nxt}"
            office = _nice_case(office)
            break
    return title_idx, title_end, title or "Wniosek", office


def _join_continuations(blocks: list[Block]) -> list[Block]:
    out: list[Block] = []
    for b in blocks:
        if out:
            prev = out[-1]
            unbalanced = prev.text.count("(") > prev.text.count(")")
            hyphen = prev.text.endswith("-") and not prev.text.endswith(" -")
            comma = prev.text.rstrip(" `'").endswith(",") and _words(prev.text) <= 8
            starts_new = (HEADING.match(b.text) or SUBITEM.match(b.text) or FILL.fullmatch(b.text)
                          or b.kind == "checkbox")
            if (unbalanced or hyphen or comma) and not starts_new and _words(prev.text) < 40:
                joiner = "" if hyphen else " "
                base = prev.text[:-1] if hyphen else prev.text.rstrip(" `'")
                prev.text = base + joiner + b.text
                prev.confidence = min(prev.confidence, b.confidence)
                continue
        out.append(Block(b.text, b.page, b.kind, b.confidence))
    return out


def understand(ir: DocumentIR, catalog: Catalog | None = None) -> FormIR:
    c = catalog or load_catalog()
    blocks = _join_continuations(ir.blocks)
    title_idx, title_end, title, office = _detect_header(blocks)
    b = _Builder(c)
    b.open_section("Nagłówek", header=True)

    date_marker = re.compile(r"^dd[-./ ]mm[-./ ]rrrr$", re.I)
    body_open = False
    for i, block in enumerate(blocks):
        text = block.text.strip()
        if not body_open and i > title_end:
            body_open = True
            b.open_section(_body_title(title))
        if i == title_idx or (title_idx >= 0 and i < title_idx and OFFICE.match(text)):
            continue
        if title_idx >= 0 and title_idx < i <= title_end:
            continue  # dalsze linie tytułu
        if date_marker.match(text.replace(" ", "")) or date_marker.match(text):
            if b.cur.fields:
                b.cur.fields[-1].type = FieldType.DATEPICKER
            continue
        if _any_phrase(text, c.drop_lines) and _words(text) <= 8:
            continue
        if title_idx >= 0 and i < title_idx:
            # nagłówek pisma: dane wnioskodawcy (kropki + podpowiedzi); adres urzędu itp. pomijamy
            if FILL.search(text) or HINT.match(text) or b.pending_unlabeled:
                b.handle(block)
            continue

        m = HEADING.match(text)
        if m:
            num = m["num"]
            if ROMAN.match(num):
                b.last_top = 0
                b.open_section(m["title"], page_break=True)
                continue
            top = int(num.split(".")[0])
            depth = len([p for p in num.split(".") if p])
            accept = (depth == 1 and top == b.last_top + 1) or (depth > 1 and top == b.last_top)
            accept = accept or (depth == 1 and b.last_top == 0)
            if accept and not FILL.search(m["title"]):
                if depth == 1:
                    b.last_top = top
                b.open_section(m["title"])
                continue
            if accept and FILL.search(m["title"]):
                if depth == 1:
                    b.last_top = top
                # „1. Cel wynajęcia świetlicy: ……” – numerowane pole w bieżącej sekcji
                b.handle(Block(m["title"], block.page, block.kind, block.confidence))
                continue
        b.handle(block)

    form = b.finish(title, office)
    if not form.all_fields():
        form.notes.append("Nie rozpoznano pól przedmiotu wniosku – sprawdź dokument ręcznie.")
    return form
