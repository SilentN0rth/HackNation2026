import re
from dataclasses import asdict, dataclass

from app.coi.jsonata import references
from app.coi.walk import CHOICE_TYPES, FIELD_TYPES, INPUT_TYPES, SECTION_TYPES, VALIDATORS, children

TECH_NAME = re.compile(r"^[a-z0-9_]+$")
MAX_TITLE = 255
GRID_COLUMNS = 3
SELECT_ONLY_DICTIONARIES = {"Kraje", "Województwo", "Powiat", "Gmina", "Miejscowość", "Numery kierunkowe", "TERYT_4G_DOWODOWY", "TERYT_DOWODOWY"}
SECTION_STATES = {"SHOW"}
FIELD_STATES = {"SHOW", "READ_ONLY"}


@dataclass
class Issue:
    code: str
    severity: str
    message: str
    tab: str | None = None
    tech_name: str | None = None
    field_id: str | None = None
    tab_id: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def _grid(cell: dict, tab: dict, field: dict, issues: list[Issue]) -> None:
    x, cols = cell.get("x", 0), cell.get("cols", 0)
    if not isinstance(x, (int, float)) or not isinstance(cols, (int, float)) or cols < 1 or x < 0 or x + cols > GRID_COLUMNS:
        issues.append(
            Issue("grid", "error", "Pole wychodzi poza siatkę trzech kolumn.", tab["title"], field.get("techName"), field.get("id"), tab.get("id"))
        )


def validate(coi: dict) -> list[Issue]:
    issues: list[Issue] = []
    title = coi.get("title")
    if not isinstance(title, str) or not title.strip():
        issues.append(Issue("title", "error", "Formularz nie ma tytułu."))
    elif len(title) > MAX_TITLE:
        issues.append(Issue("title", "error", f"Tytuł formularza ma więcej niż {MAX_TITLE} znaków."))

    tabs = coi.get("tabs")
    if not isinstance(tabs, list) or len(tabs) < 2:
        issues.append(Issue("tabs", "error", "Formularz musi mieć co najmniej dwie strony."))
        return issues
    if tabs[-1].get("type") != "FINISH":
        issues.append(Issue("finish", "error", "Ostatnia strona formularza musi być stroną końcową (FINISH)."))
    if sum(1 for t in tabs if t.get("type") == "FINISH") > 1:
        issues.append(Issue("finish", "error", "Formularz może mieć tylko jedną stronę końcową."))

    tab_ids = set()
    tab_titles: set[str] = set()
    tech_names: dict[str, str] = {}
    field_ids: set[str] = set()

    for tab in tabs:
        tab_title = tab.get("title", "")
        if tab.get("type") not in ("MAIN", "FINISH"):
            issues.append(Issue("tab-type", "error", f"Strona „{tab_title}” ma nieznany typ.", tab_title, tab_id=tab.get("id")))
        if not tab_title:
            issues.append(Issue("tab-title", "error", "Strona nie ma tytułu.", tab_id=tab.get("id")))
        if tab_title in tab_titles:
            issues.append(Issue("tab-title", "error", f"Tytuł strony „{tab_title}” się powtarza, a warunki odwołują się do tytułów stron.", tab_title, tab_id=tab.get("id")))
        tab_titles.add(tab_title)
        tab_ids.add(tab.get("id"))
        questions = tab.get("questions") or []
        if not questions:
            issues.append(Issue("empty-tab", "error", f"Strona „{tab_title}” nie zawiera żadnego pola.", tab_title, tab_id=tab.get("id")))

        for question in questions:
            field = question.get("field") or {}
            _grid(question, tab, field, issues)
            if field.get("type") not in SECTION_TYPES:
                issues.append(
                    Issue("outside-section", "error", f"Pole „{field.get('title') or field.get('techName')}” musi leżeć w sekcji.", tab_title, field.get("techName"), field.get("id"), tab.get("id"))
                )
            for item in [field, *[c.get("field") or {} for c in children(field)]]:
                fid, tech, ftype = item.get("id"), item.get("techName"), item.get("type")
                label = item.get("title") or tech or "bez nazwy"
                if not fid:
                    issues.append(Issue("id", "error", f"Pole „{label}” nie ma identyfikatora.", tab_title, tech, tab_id=tab.get("id")))
                elif fid in field_ids:
                    issues.append(Issue("id", "error", f"Identyfikator pola „{label}” się powtarza.", tab_title, tech, fid, tab.get("id")))
                field_ids.add(fid)
                if not tech or not TECH_NAME.match(tech):
                    issues.append(Issue("tech-name", "error", f"Pole „{label}” ma nieprawidłową nazwę techniczną.", tab_title, tech, fid, tab.get("id")))
                elif tech in tech_names:
                    issues.append(Issue("tech-name", "error", f"Nazwa techniczna „{tech}” się powtarza.", tab_title, tech, fid, tab.get("id")))
                else:
                    tech_names[tech] = fid
                if ftype not in FIELD_TYPES:
                    issues.append(Issue("type", "error", f"Pole „{label}” ma nieznany typ {ftype}.", tab_title, tech, fid, tab.get("id")))
                unknown = [v for v in item.get("validation") or [] if v not in VALIDATORS]
                if unknown:
                    issues.append(Issue("validation", "error", f"Pole „{label}” ma nieznane walidatory: {', '.join(map(str, unknown))}.", tab_title, tech, fid, tab.get("id")))
                if ftype in INPUT_TYPES and not isinstance(item.get("validation"), list):
                    issues.append(Issue("required-attr", "warning", f"Pole „{label}” nie ma określonej obligatoryjności (lista validation).", tab_title, tech, fid, tab.get("id")))
                format_only = [v for v in item.get("validation") or [] if v in VALIDATORS and v != "REQUIRED"]
                if format_only and ftype != "TEXT_FIELD":
                    issues.append(Issue("validation", "warning", f"Walidator {', '.join(format_only)} ma sens tylko w polu tekstowym („{label}”).", tab_title, tech, fid, tab.get("id")))
                if ftype == "INFO_SECTION" and not (item.get("description") or "").strip():
                    issues.append(Issue("info-section", "error", f"Sekcja informacyjna „{label}” nie ma opisu.", tab_title, tech, fid, tab.get("id")))
                if ftype == "CONSENT_SECTION":
                    consents = (item.get("consentSectionConfig") or {}).get("consents")
                    if not consents or any(not (c.get("description") or "").strip() or not isinstance(c.get("required"), bool) for c in consents):
                        issues.append(Issue("consent", "error", f"Sekcja zgód „{label}” musi mieć zgody z opisem i znacznikiem required.", tab_title, tech, fid, tab.get("id")))
                if item.get("dictionaryName"):
                    if ftype not in CHOICE_TYPES:
                        issues.append(Issue("dictionary", "error", f"Słownik można podpiąć tylko do listy, pola jednokrotnego lub wielokrotnego wyboru („{label}”).", tab_title, tech, fid, tab.get("id")))
                    if item.get("options"):
                        issues.append(Issue("dictionary", "error", f"Pole „{label}” ma słownik, więc lista opcji musi być pusta.", tab_title, tech, fid, tab.get("id")))
                elif ftype in CHOICE_TYPES and not item.get("options"):
                    issues.append(Issue("options", "error", f"Pole wyboru „{label}” nie ma opcji ani słownika.", tab_title, tech, fid, tab.get("id")))
                if tab.get("type") == "FINISH" and ftype in INPUT_TYPES:
                    issues.append(Issue("finish-input", "error", f"Strona końcowa nie może zawierać pola do wypełnienia („{label}”).", tab_title, tech, fid, tab.get("id")))
                elif tab.get("type") == "FINISH" and ftype not in SECTION_TYPES | {"INFO_SECTION"}:
                    severity = "warning" if ftype == "TEXT_BLOCK" else "error"  # wzorce organizatora używają TEXT_BLOCK
                    issues.append(Issue("finish-type", severity, f"Na stronie końcowej reguły dopuszczają tylko sekcję informacyjną (INFO_SECTION), a pole „{label}” ma typ {ftype}.", tab_title, tech, fid, tab.get("id")))
                if item.get("dictionaryName") in SELECT_ONLY_DICTIONARIES and ftype != "SELECT":
                    issues.append(Issue("dictionary", "error", f"Słownik „{item['dictionaryName']}” można podpiąć tylko do listy rozwijanej („{label}”).", tab_title, tech, fid, tab.get("id")))
                allowed = SECTION_STATES if ftype in SECTION_TYPES else FIELD_STATES
                for state in item.get("states") or []:
                    if state.get("type") not in allowed or not (state.get("query") or "").strip():
                        issues.append(Issue("state", "error", f"Pole „{label}” ma niepoprawny stan dynamiczny.", tab_title, tech, fid, tab.get("id")))
            if field.get("type") in SECTION_TYPES:
                if not (field.get("title") or "").strip():
                    issues.append(Issue("section-title", "error", "Sekcja nie ma nazwy.", tab_title, field.get("techName"), field.get("id"), tab.get("id")))
                if not children(field):
                    issues.append(Issue("empty-section", "error", f"Sekcja „{field.get('title') or field.get('techName')}” nie zawiera pól.", tab_title, field.get("techName"), field.get("id"), tab.get("id")))
            for child in children(field):
                _grid(child, tab, child.get("field") or {}, issues)
                if (child.get("field") or {}).get("type") in SECTION_TYPES:
                    issues.append(Issue("nested-section", "error", "Sekcji nie wolno zagnieżdżać.", tab_title, child["field"].get("techName"), child["field"].get("id"), tab.get("id")))

    links = (coi.get("flow") or {}).get("links") or []
    for link in links:
        if link.get("source") not in tab_ids or link.get("target") not in tab_ids:
            issues.append(Issue("flow", "error", "Przejście między stronami wskazuje nieistniejącą stronę."))
    sources, targets = {link.get("source") for link in links}, {link.get("target") for link in links}
    for position, tab in enumerate(tabs):
        title_ = tab.get("title", "")
        if position > 0 and tab.get("id") not in targets:
            issues.append(Issue("flow", "error", f"Do strony „{title_}” nie prowadzi żadne przejście.", title_, tab_id=tab.get("id")))
        if tab.get("type") != "FINISH" and tab.get("id") not in sources:
            issues.append(Issue("flow", "error", f"Ze strony „{title_}” nie wychodzi żadne przejście.", title_, tab_id=tab.get("id")))
    known = {(t.get("title"), q["field"].get("techName"), c["field"].get("techName")) for t in tabs for q in t.get("questions") or [] for c in children(q.get("field") or {})}
    for tab in tabs:
        for question in tab.get("questions") or []:
            for item in [question.get("field") or {}, *[c.get("field") or {} for c in children(question.get("field") or {})]]:
                for state in item.get("states") or []:
                    for ref in references(state.get("query") or ""):
                        if (ref.tab, ref.section, ref.field) not in known:
                            issues.append(Issue("state-ref", "error", f"Warunek pola „{item.get('title') or item.get('techName')}” wskazuje nieistniejące pole „{ref.field}”.", tab.get("title"), item.get("techName"), item.get("id"), tab.get("id")))
    return issues


def errors(coi: dict) -> list[Issue]:
    return [i for i in validate(coi) if i.severity == "error"]
