import re
from dataclasses import dataclass, field

from app.extract.ir import Document
from app.understand.catalog import any_match, catalog, rewrite
from app.understand.model import Condition, FieldIR, FormIR, PageIR, SectionIR
from app.understand.text import (
    LEADER,
    clean,
    fold,
    is_junk_title,
    is_upper,
    normalize_title,
    plain_label,
    sentence_case,
    starts_with_box,
)

SECTION_NUMBER = re.compile(r"^\s*(\d{1,2}(?:\.\d{1,2})*|[IVXLC]{1,5}|[A-H])[.)]\s*(\S.*)$")
NUMBER_ONLY = re.compile(r"^\s*(\d{1,2}(?:\.\d{1,2})*|[IVXLC]{1,5}|[a-hA-H])[.)]?\s*$")
DATE_HINT = re.compile(r"^\s*(dd|rrrr|d\s?d\s?[-./]\s?m\s?m)\s*[-./ ]?", re.I)
FIELD_NUMBER_SPLIT = re.compile(r"\s\d{1,3}\.\s(?=[A-ZĄĆĘŁŃÓŚŹŻ])")
YES_NO_TAIL = re.compile(r"[\s:]*\btak\b[\s/,]*\bnie\b\s*$", re.I)
OPTIONAL = re.compile(r"jeśli dotyczy|jeżeli dotyczy|nieobowiązkow|opcjonaln|o ile (posiada|dotyczy)|nie są obowiązkowe", re.I)
INSTRUCTION = re.compile(r"^(wpisz|podaj|zaznacz|wypełnij|uzupełnij|należy)\b", re.I)
COMPOUND = [
    "numer domu",
    "numer lokalu",
    "nr domu",
    "nr lokalu",
    "kod pocztowy",
    "miejscowość",
    "ulica",
    "gmina",
    "powiat",
    "województwo",
    "poczta",
    "pesel",
    "nip",
    "regon",
]
RESERVED_PAGE_TITLES = {"dane", "kontakt i zgody", "strona końcowa"}
MAX_LABEL = 150
MAX_FIELDS_PER_PAGE = 12
ENUMERATED = re.compile(r"^\s*(?:\d{1,2}\)|[a-z]\)|[-•–])\s*(\S.*)$")
ADDRESS = re.compile(r"\b\d{2}-\d{3}\b|^[A-ZĄĆĘŁŃÓŚŹŻ][\w.-]*(?: [\w.-]+){0,3} \d+[a-zA-Z]?(?:/\d+)?$")
NARRATIVE = re.compile(r"^(wnoszę|proszę|zwracam się|ubiegam się)\b", re.I)
ATTACHMENTS_LINE = re.compile(r"^(w\s+)?załącz", re.I)
ISSUER_INLINE = re.compile(r"((?:Urząd (?:Miasta i Gminy|Miasta|Gminy|Miejski w|Dzielnicy)|Wójt Gminy|Burmistrz (?:Miasta i Gminy|Miasta|Gminy)?|Prezydent Miasta|Starosta)\s+[A-ZĄĆĘŁŃÓŚŹŻ][\w-]+(?:[ -][A-ZĄĆĘŁŃÓŚŹŻ][\w-]+)?)")
BLANK_CUE = re.compile(r"\b(w kwocie|kwotę|w wysokości)\s*$", re.I)
SENTENCE = re.compile(r"[a-ząćęłńóśźż]{3,}.*[.;]$")
LEADING_CAPS = re.compile(r"^[A-ZĄĆĘŁŃÓŚŹŻ]{4,}(?: [A-ZĄĆĘŁŃÓŚŹŻ]{4,})+\b")
ROMAN = {"I": 1, "II": 2, "III": 3, "IV": 4, "V": 5, "VI": 6, "VII": 7, "VIII": 8, "IX": 9, "X": 10, "XI": 11, "XII": 12}


@dataclass
class Item:
    text: str
    page: int = 1
    heading: bool = False
    cell: bool = False
    date: bool = False
    option: bool = False
    blank: bool = False  # w źródle jest linia do wypełnienia (kropki, wielokropek)


@dataclass
class RawSection:
    header: str
    kind: str
    page: int
    items: list[Item] = field(default_factory=list)


def _balanced(text: str) -> bool:
    return text.count("(") <= text.count(")")


def _split_compound(text: str) -> list[str]:
    lower = text.lower()
    hits = sorted({lower.find(token) for token in COMPOUND if lower.find(token) >= 0})
    hits = [h for h in hits if h == 0 or lower[h - 1] == " "]
    if len(hits) < 2 or len(text) > 90:
        return [text]
    bounds = hits + [len(text)]
    parts = [text[bounds[i] : bounds[i + 1]].strip(" ,;") for i in range(len(hits))]
    head = text[: hits[0]].strip(" ,;")
    return ([head] if head else []) + [p for p in parts if p]


def prepare(doc: Document) -> list[Item]:
    rules = catalog()
    items: list[Item] = []
    pending_number = ""
    for line in doc.lines:
        raw = line.text.strip()
        if DATE_HINT.match(raw):
            if items:
                items[-1].date = True
            continue
        if NUMBER_ONLY.match(raw):
            pending_number = "" if raw.endswith(")") else raw.rstrip(".") + ". "
            continue
        option = starts_with_box(raw)
        blank = bool(LEADER.search(raw))
        text = clean(raw)
        if not text:
            continue
        if pending_number:
            text = pending_number + text
            pending_number = ""
        if any_match(rules.skip_lines, text):
            continue
        if items and items[-1].text == text:
            continue
        previous = items[-1] if items else None
        closes = text.count(")") > text.count("(")
        joinable = (
            previous is not None
            and (closes or not option)
            and not SECTION_NUMBER.match(text)
            and not ATTACHMENTS_LINE.match(text)
            and not ENUMERATED.match(text)
            and (
                previous.text.endswith(",")
                or not _balanced(previous.text)
                or (text[0].islower() and not previous.text.endswith((".", ":", "?", ")")))
            )
        )
        if joinable and len(previous.text) + len(text) < 400:
            previous.text = f"{previous.text} {text}"
            previous.blank = previous.blank or blank
            continue
        for chunk in FIELD_NUMBER_SPLIT.split(text) if len(text) < 160 else [text]:
            for part in _split_compound(chunk):
                items.append(Item(part, line.page, line.heading, line.cell, option=option, blank=blank))
    return items


def _title_and_issuer(items: list[Item]) -> tuple[str | None, str | None, set[int]]:
    rules = catalog()
    title = issuer = None
    used: set[int] = set()
    for index, item in enumerate(items[:30]):
        text = item.text
        if title is None and any_match(rules.titles, text) and len(text) < 220:
            title = text
            used.add(index)
            nxt = items[index + 1] if index + 1 < len(items) else None
            if nxt and len(text) < 25 and (nxt.text[:1].islower() or nxt.text.lower().startswith(("o ", "w sprawie", "dotycz"))):
                title = f"{text} {nxt.text}"
                used.add(index + 1)
        elif issuer is None and any_match(rules.issuers, text) and len(text) < 120:
            issuer = re.sub(r"^do\s+", "", text, flags=re.I).rstrip(":,")
            used.add(index)
            following = items[index + 1 : index + 4]
            if len(issuer.split()) <= 3 and following and re.fullmatch(r"[A-ZĄĆĘŁŃÓŚŹŻ][\w-]+(?: [A-ZĄĆĘŁŃÓŚŹŻ][\w-]+)?", following[0].text):
                issuer = f"{issuer} {following[0].text}"
                used.add(index + 1)
            for offset, extra in enumerate(following, start=index + 1):
                if ADDRESS.search(extra.text) and len(extra.text) < 45 and not SECTION_NUMBER.match(extra.text):
                    used.add(offset)
        elif issuer is None and (inline := ISSUER_INLINE.search(text)):
            issuer = inline.group(1)
    if title:
        title = normalize_title(title)
    if issuer:
        issuer = " ".join(w if not w.isupper() or len(w) < 3 else w.capitalize() for w in issuer.split())
    return title, issuer, used


def _section_number(text: str) -> tuple[list[int], str] | None:
    match = SECTION_NUMBER.match(text)
    if not match:
        return None
    raw, rest = match.groups()
    if not rest[:1].isupper() and not rest[:1].isdigit():
        return None
    if raw.upper() in ROMAN:
        return [ROMAN[raw.upper()]], rest
    if raw.isalpha():
        return [ord(raw.upper()) - 64], rest
    return [int(p) for p in raw.split(".") if p], rest


def _kind(header: str) -> str:
    rules = catalog()
    if any_match(rules.skip_sections, header):
        return "skip"
    if any_match(rules.legal_sections, header):
        return "legal"
    if any_match(rules.applicant_sections, header):
        return "applicant"
    if any_match(rules.attachment_sections, header):
        return "attachments"
    if any_match(rules.statement_sections, header):
        return "statements"
    return "content"


LABEL_ONLY = {"tak", "nie", "tak nie", "tak / nie", "tak/nie"}
CONSENT_START = re.compile(
    r"^\s*(wyrażam\s+zgodę|oświadczam|oświadczamy|zapoznał|informacje\s+na\s+temat\s+ochrony\s+danych|klauzula\s+informacyjna)", re.I
)


def _label_like(text: str) -> bool:
    """Krótka etykieta pola (PESEL, NIP, TAK NIE), która nie otwiera nowej sekcji, nawet gdy jest pisana wielkimi literami."""
    folded = fold(text).strip(" :.")
    if folded in LABEL_ONLY:
        return True
    lowered = text.lower()
    return len(text.split()) <= 2 and any(rule.pattern.search(lowered) for rule in catalog().fields)


def split_sections(items: list[Item]) -> list[RawSection]:
    sections: list[RawSection] = []
    current = RawSection(header="", kind="content", page=1)
    top: int | None = None
    for item in items:
        number = _section_number(item.text)
        is_section = False
        if number:
            parts, rest = number
            plausible = len(rest) <= 180 and not rest.rstrip().endswith(".")
            if plausible and len(parts) == 1 and (top is None or parts[0] == top + 1):
                top = parts[0]
                is_section = True
            elif plausible and len(parts) >= 2 and parts[0] == top:
                is_section = True
        elif _label_like(item.text):
            pass
        elif (item.heading and not item.cell and len(item.text) <= 90) or (
            is_upper(item.text) and sum(c.isalpha() for c in item.text) >= 6 and len(item.text) <= 90 and not item.text.endswith("?")
        ):
            is_section = True
        elif LEADING_CAPS.match(item.text):
            is_section = True
        if is_section:
            if current.header or current.items:
                sections.append(current)
            current = RawSection(header=item.text, kind=_kind(item.text), page=item.page)
            continue
        current.items.append(item)
    if current.header or current.items:
        sections.append(current)
    for index, section in enumerate(sections):
        if section.kind == "content" and index > 0 and sections[index - 1].kind == "applicant":
            parent = sections[index - 1].header
            nested = _section_number(section.header)
            parent_number = _section_number(parent)
            if nested and parent_number and len(nested[0]) > 1 and nested[0][0] == parent_number[0][0]:
                section.kind = "applicant"
    return sections


class Builder:
    def __init__(self) -> None:
        self.counter = 0
        self.rules = catalog()

    def key(self) -> str:
        self.counter += 1
        return f"f{self.counter}"

    def classify(self, label: str, item: Item | None = None, required: bool = True) -> FieldIR:
        title, forced = rewrite(plain_label(label))
        if len(title) > 120:
            title = title[:117].rsplit(" ", 1)[0] + "…"
        field_ir = FieldIR(key=self.key(), title=title, source=label, page=item.page if item else 1)
        if forced:
            field_ir.type = forced
        lowered = label.lower()
        for rule in self.rules.fields:
            if not rule.pattern.search(lowered):
                continue
            if rule.type and field_ir.type == "TEXT_FIELD" and field_ir.dictionary is None:
                field_ir.type = rule.type
            for v in rule.validation:
                if v not in field_ir.validation:
                    field_ir.validation.append(v)
            if rule.dictionary and field_ir.dictionary is None:
                field_ir.dictionary = rule.dictionary
                field_ir.type = rule.type or "SELECT"
            if rule.tooltip and not field_ir.tooltip:
                field_ir.tooltip = rule.tooltip
        if item is not None and item.date:
            field_ir.type = "DATEPICKER"
        field_ir.required = required and not OPTIONAL.search(label)
        if not field_ir.required and OPTIONAL.search(label):
            field_ir.title = re.sub(r"\s*\((jeśli|jeżeli) dotyczy\)", "", field_ir.title, flags=re.I)
            field_ir.tooltip = field_ir.tooltip or "Wypełnij, jeśli dotyczy."
        return field_ir

    def radio(self, title: str, options: list[str], source: str, page: int, required: bool = True) -> FieldIR:
        clean_options: list[str] = []
        for option in options:
            value = plain_label(option)
            if value and value not in clean_options:
                clean_options.append(value)
        kind = "RADIO" if len(clean_options) <= 5 else "SELECT"
        return FieldIR(
            key=self.key(),
            title=rewrite(plain_label(title))[0],
            type=kind,
            required=required,
            options=clean_options,
            source=source,
            page=page,
        )


def _match_option(text: str, options: list[str]) -> str:
    words = set(re.findall(r"[a-z]{4,}", fold(text)))
    best, score = options[-1], 0
    for option in options:
        overlap = len(words & set(re.findall(r"[a-z]{4,}", fold(option))))
        if overlap > score:
            best, score = option, overlap
    return best


def _consent_field(builder: Builder, consents: list[tuple[str, Item]]) -> FieldIR:
    return FieldIR(
        key=builder.key(),
        title="",
        type="CONSENT_SECTION",
        required=False,
        options=[label for label, _ in consents],
        source=consents[0][1].text,
        page=consents[0][1].page,
    )


def build_section(raw: RawSection, builder: Builder, form: FormIR) -> SectionIR | None:
    rules = catalog()
    title = plain_label(raw.header) if raw.header else "Szczegóły wniosku"
    section = SectionIR(title=title or "Szczegóły wniosku")
    if raw.kind in ("skip", "applicant"):
        return None
    if raw.kind == "legal":
        form.legal_basis.extend(clean(i.text) for i in raw.items if clean(i.text))
        return None
    if raw.kind == "attachments":
        for item in raw.items:
            label = plain_label(item.text)
            if not label or any_match(rules.choice_hints, label) or len(label) > MAX_LABEL:
                continue
            section.fields.append(
                FieldIR(key=builder.key(), title=label, type="FILE_UPLOADER", required=False, source=item.text, page=item.page)
            )
        return section if section.fields else None
    if raw.kind == "statements":
        consents = [(plain_label(i.text), i) for i in raw.items]
        consents = [(label, i) for label, i in consents if len(label) >= 8 and not (label.endswith(")") and "(" not in label)]
        if consents:
            section.fields.append(_consent_field(builder, consents))
        return section if section.fields else None

    choice = any_match(rules.choice_hints, raw.header)
    describe = any_match(rules.describe_hints, raw.header)
    items = list(raw.items)
    last_choice: FieldIR | None = None
    pending: Condition | None = None

    if choice:
        options: list[Item] = []
        while items and not any_match(rules.conditions, items[0].text) and len(items[0].text) <= MAX_LABEL:
            if items[0].text.endswith(":") and options:
                break
            options.append(items.pop(0))
        if len(options) >= 2:
            last_choice = builder.radio(section.title, [o.text for o in options], raw.header, raw.page)
            section.fields.append(last_choice)
        else:
            items = options + items

    attachments_mode = False
    consent_items: list[tuple[str, Item]] = []
    preamble = not raw.header
    index = 0
    while index < len(items):
        item = items[index]
        index += 1
        text = item.text
        if ATTACHMENTS_LINE.match(text) and len(text) < 40:
            attachments_mode = True
            continue
        if CONSENT_START.match(text) and len(text) >= 20 and not attachments_mode:
            consent_items.append((plain_label(text), item))
            continue
        enumerated = ENUMERATED.match(text)
        if attachments_mode:
            label = plain_label(enumerated.group(1) if enumerated else text)
            if label and len(label) <= MAX_LABEL:
                section.fields.append(
                    FieldIR(key=builder.key(), title=label, type="FILE_UPLOADER", required=False, source=text, page=item.page)
                )
            continue
        def is_option(candidate: Item) -> bool:
            return candidate.option or bool(ENUMERATED.match(candidate.text))

        if not item.option and not enumerated and index < len(items) and is_option(items[index]) and len(text) <= MAX_LABEL:
            start = index
            options: list[str] = []
            while (
                index < len(items)
                and is_option(items[index])
                and len(items[index].text) <= 120
                and not ATTACHMENTS_LINE.match(items[index].text)
            ):
                match = ENUMERATED.match(items[index].text)
                value = match.group(1) if match else items[index].text
                if plain_label(value):
                    options.append(value)
                index += 1
            if len(options) >= 2:
                follow: list[FieldIR] = []
                trimmed: list[str] = []
                for value in options:
                    label = plain_label(value)
                    for rule in rules.follow_ups:
                        if rule.pattern.search(label):
                            if rule.trim:
                                label = rule.trim.sub("", label)
                            extra = builder.classify(rule.title, item)
                            extra.tooltip = rule.tooltip or extra.tooltip
                            extra.condition = Condition("", label)
                            follow.append(extra)
                            break
                    trimmed.append(label)
                last_choice = builder.radio(text, trimmed, text, item.page)
                section.fields.append(last_choice)
                for extra in follow:
                    extra.condition = Condition(last_choice.key, extra.condition.equals)
                    section.fields.append(extra)
                other = next((o for o in last_choice.options if fold(o).startswith("inne")), None)
                if other:
                    extra = builder.classify("Jakie?", item)
                    extra.title = "Opisz, czego dotyczy wniosek"
                    extra.condition = Condition(last_choice.key, other)
                    section.fields.append(extra)
                continue
            index = start
        if preamble and any_match(rules.standard, plain_label(text)) and len(text) < 120:
            continue
        gaps = [gap for gap in rules.gaps if gap.pattern.search(text)]
        if gaps and (NARRATIVE.match(text) or len(gaps) >= 2 or len(text) > 60):
            for gap in gaps:
                gap_field = builder.classify(gap.title, item)
                if gap.type:
                    gap_field.type = gap.type
                gap_field.source = text
                section.fields.append(gap_field)
            continue
        if NARRATIVE.match(text) and len(text) > 40:
            continue
        if any_match(rules.legal_sections, text) or re.search(r"\bart\.\s*\d+.*\bustawy\b", text, re.I):
            form.legal_basis.append(text)
            if BLANK_CUE.search(text):
                section.fields.append(builder.classify("Kwota", item))
            continue
        if BLANK_CUE.search(text) and len(text) > 40:
            section.fields.append(builder.classify("Kwota", item))
            continue
        if any_match(rules.conditions, text):
            if last_choice and last_choice.options:
                pending = Condition(last_choice.key, _match_option(text, last_choice.options))
            continue
        if INSTRUCTION.match(text) and len(text) > 40:
            continue
        if SENTENCE.search(text) and len(text) > 50 and not text.lower().startswith("oświadczam"):
            continue
        if len(text) > MAX_LABEL:
            if CONSENT_START.match(text):
                consent_items.append((plain_label(text), item))
            continue
        if YES_NO_TAIL.search(text):
            field_ir = builder.radio(YES_NO_TAIL.sub("", text), ["Tak", "Nie"], text, item.page)
            last_choice = field_ir
        elif text.rstrip().endswith("?"):
            field_ir = builder.radio(text, ["Tak", "Nie"], text, item.page)
            last_choice = field_ir
        else:
            field_ir = builder.classify(text, item)
        if not field_ir.title:
            continue
        if pending:
            field_ir.condition = pending
        section.fields.append(field_ir)

    if consent_items:
        section.fields.append(_consent_field(builder, consent_items))
    if not section.fields and (describe or raw.header):
        if describe or raw.items == []:
            field_ir = builder.classify(raw.header)
            field_ir.title = section.title
            if describe:
                field_ir.type = "TEXTAREA"
            section.fields.append(field_ir)
    return section if section.fields else None


def _unique(title: str, used: set[str]) -> str:
    candidate, n = title, 2
    while candidate.lower() in used:
        candidate = f"{title} ({n})"
        n += 1
    used.add(candidate.lower())
    return candidate


MAX_FIELDS_PER_SECTION = 14


def _split_heavy(sections: list[SectionIR]) -> list[SectionIR]:
    """Sekcje z bardzo wieloma polami dzielimy na części, żeby formularz dało się przejść bez przewijania ściany pól."""
    result: list[SectionIR] = []
    for section in sections:
        if len(section.fields) <= MAX_FIELDS_PER_SECTION:
            result.append(section)
            continue
        parts = -(-len(section.fields) // MAX_FIELDS_PER_SECTION)
        size = -(-len(section.fields) // parts)
        for n in range(parts):
            chunk = section.fields[n * size : (n + 1) * size]
            result.append(SectionIR(title=f"{section.title} (część {n + 1} z {parts})", fields=chunk, condition=section.condition))
    return result


def paginate(sections: list[SectionIR]) -> list[PageIR]:
    sections = _split_heavy(sections)
    pages: list[PageIR] = []
    current: PageIR | None = None
    count = 0
    for section in sections:
        size = len(section.fields)
        same = current is not None and current.sections[-1].condition == section.condition
        if current is None or not same or (count and count + size > MAX_FIELDS_PER_PAGE):
            current = PageIR(title=section.title)
            pages.append(current)
            count = 0
        current.sections.append(section)
        count += size
    used = set(RESERVED_PAGE_TITLES)
    for page in pages:
        if is_junk_title(page.title):
            page.title = "Szczegóły wniosku"
        page.title = _unique(page.title, used)
    return pages


VARIANT = re.compile(r"^(?:[IVX]{1,4}[.)]\s*)?wniosek o przyznanie\s+(stypendium|nagrody|wyróżnienia)\b", re.I)
PREAMBLE = re.compile(r"^(załącznik\s+nr|(?:nr|numer)\s+\d|z\s+dnia|rodzaje\s+wniosków|prezydenta|burmistrza|wójta)(?:\b|\d)", re.I)
VARIANT_LABELS = {"stypendium": "Stypendium sportowe", "nagrody": "Nagroda sportowa", "wyróżnienia": "Wyróżnienie sportowe"}
VARIANT_SHORT = {"stypendium": "Stypendium", "nagrody": "Nagroda", "wyróżnienia": "Wyróżnienie"}


def _split_variants(items: list[Item], skip: set[int]) -> tuple[list[Item], list[tuple[str, list[Item]]], str] | None:
    """Formularz łączący kilka wniosków: spis na początku, potem bloki z nagłówkami „Wniosek o przyznanie …”.

    Spis to nagłówki leżące tuż obok siebie; początek bloku to nagłówek, po którym długo nie ma kolejnego.
    """
    found = [i for i, item in enumerate(items) if VARIANT.match(item.text)]
    starts = [i for n, i in enumerate(found) if n + 1 == len(found) or found[n + 1] - i >= 10]
    kinds = [VARIANT.match(items[i].text).group(1).lower() for i in starts]
    if len(starts) < 2 or len(set(kinds)) < 2:
        return None
    index_lines = {i for i in found if i not in starts and i < starts[0]}
    common = [
        item
        for i, item in enumerate(items[: starts[0]])
        if i not in index_lines and i not in skip and not PREAMBLE.match(item.text)
    ]
    blocks = []
    for n, start in enumerate(starts):
        end = starts[n + 1] if n + 1 < len(starts) else len(items)
        blocks.append((kinds[n], [x for k, x in enumerate(items[start + 1 : end], start + 1) if k not in skip]))
    return common, blocks, re.sub(r"^[IVX]{1,4}[.)]\s*", "", items[starts[0]].text)


def _build_sections(items: list[Item], builder: Builder, form: FormIR) -> list[SectionIR]:
    sections = []
    for raw in split_sections(items):
        section = build_section(raw, builder, form)
        if section:
            sections.append(section)
    return sections


def understand(doc: Document, filename: str = "") -> FormIR:
    items = prepare(doc)
    title, issuer, used = _title_and_issuer(items)
    all_items, items = items, [item for index, item in enumerate(items) if index not in used]
    form = FormIR(
        title=title or sentence_case(filename.rsplit(".", 1)[0]) or "Wniosek",
        issuer=issuer,
        warnings=list(doc.warnings),
        ocr_confidence=doc.ocr_confidence,
    )
    builder = Builder()
    variants = _split_variants(all_items, used)
    if variants:
        common, blocks, heading = variants
        kinds_found = list(dict.fromkeys(kind for kind, _ in blocks))
        match = re.match(r"^(Wniosek o przyznanie)\s+\S+\s+(\S+\s+.*)$", heading)
        if match and len(kinds_found) > 1:
            names = kinds_found
            form.title = f"{match.group(1)} {', '.join(names[:-1])} lub {names[-1]} {match.group(2)}"
        sections = _build_sections(common, builder, form)
        kinds = list(dict.fromkeys(kind for kind, _ in blocks))
        choice = builder.radio("Rodzaj wniosku", [VARIANT_LABELS[k] for k in kinds], "Rodzaje wniosków", 1)
        sections.insert(min(1, len(sections)), SectionIR(title="Rodzaj wniosku", fields=[choice]))
        for kind, block in blocks:
            for section in _build_sections(block, builder, form):
                section.title = f"{VARIANT_SHORT[kind]}: {section.title}"
                section.condition = Condition(choice.key, VARIANT_LABELS[kind])
                sections.append(section)
    else:
        sections = _build_sections(items, builder, form)
    if not sections:
        form.warnings.append("Nie rozpoznano pól specyficznych dla wniosku. Dodano pole opisowe do uzupełnienia.")
        sections = [
            SectionIR(
                title="Treść wniosku",
                fields=[FieldIR(key=builder.key(), title="Opisz swoją sprawę", type="TEXTAREA")],
            )
        ]
    used_sections: set[str] = set()
    for section in sections:
        section.title = _unique(section.title, used_sections)
    form.pages = paginate(sections)
    return form
