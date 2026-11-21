"""[5] Walidator reguł COI – Pydantic (struktura) + reguły z dokumentu „Reguły techniczne konfiguracji formularzy”.

Każdy problem ma stabilny `rule` (używany w id flagi lintera `coi-rules`) i `severity`:
  error   – import do COI się nie uda / reguła obowiązkowa złamana,
  warning – odstępstwo od reguł, które wzorce COI same stosują (np. TEXT_BLOCK na stronie FINISH),
  info    – wskazówka.
"""

import re
import uuid
from collections import Counter
from dataclasses import dataclass
from typing import Any, Literal

from pydantic import ValidationError

from app.coi.jsonata import parse_query
from app.coi.models import DICTIONARY_TYPES, INPUT_TYPES, SECTION_TYPES, VALIDATORS, CoiForm, Field_, FieldType

Severity = Literal["error", "warning", "info"]
TECHNAME_RE = re.compile(r"^[a-z0-9_]+$")


@dataclass
class Issue:
    rule: str
    severity: Severity
    message: str
    tech_name: str | None = None
    tab_title: str | None = None


def _is_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
    except (ValueError, TypeError):
        return False
    return True


def parse_form(data: dict[str, Any]) -> tuple[CoiForm | None, list[Issue]]:
    try:
        return CoiForm.model_validate(data), []
    except ValidationError as e:
        issues = [
            Issue("schema", "error", f"Niezgodność ze schematem COI: {'.'.join(map(str, err['loc']))} – {err['msg']}")
            for err in e.errors()[:20]
        ]
        return None, issues


def validate_coi(data: dict[str, Any] | CoiForm) -> list[Issue]:
    if isinstance(data, CoiForm):
        form = data
    else:
        form, issues = parse_form(data)
        if form is None:
            return issues
    return _rules(form)


def _rules(form: CoiForm) -> list[Issue]:
    out: list[Issue] = []
    add = out.append

    if not form.title.strip():
        add(Issue("title-missing", "error", "Formularz nie ma tytułu (nazwy usługi)."))
    if len(form.title) > 255:
        add(Issue("title-too-long", "error", f"Tytuł ma {len(form.title)} znaków – limit COI to 255."))

    if len(form.tabs) < 2:
        add(Issue("min-tabs", "error", "Formularz musi mieć co najmniej dwie strony."))
    if form.tabs and form.tabs[-1].type != "FINISH":
        add(Issue("last-not-finish", "error", "Ostatnia strona musi być stroną końcową (FINISH)."))
    finish_count = sum(1 for t in form.tabs if t.type == "FINISH")
    if finish_count != 1:
        add(Issue("finish-count", "error", f"Formularz musi mieć dokładnie jedną stronę FINISH (jest {finish_count})."))

    tech_names: list[str] = []
    all_ids: list[str] = []
    tab_titles = Counter(t.title for t in form.tabs)
    for title, n in tab_titles.items():
        if n > 1:
            add(Issue("tab-title-duplicate", "error", f"Dwie strony mają ten sam tytuł „{title}” – warunki JSONata "
                                                       "odwołują się do tytułu strony.", tab_title=title))

    for tab in form.tabs:
        all_ids.append(tab.id)
        if not tab.questions:
            add(Issue("tab-empty", "error", f"Strona „{tab.title}” nie ma żadnego pola.", tab_title=tab.title))
        for q in tab.questions:
            sec = q.field
            all_ids.append(sec.id)
            tech_names.append(sec.techName)
            if sec.type not in SECTION_TYPES:
                if tab.type == "FINISH" and sec.type == FieldType.INFO_SECTION:
                    continue  # dopuszczalne wprost na stronie końcowej
                add(Issue("field-outside-section", "error",
                          f"Pole „{sec.title or sec.techName}” leży bezpośrednio na stronie – musi być w sekcji.",
                          sec.techName, tab.title))
                continue
            if not sec.title.strip():
                add(Issue("section-title-missing", "error", f"Sekcja {sec.techName} nie ma nazwy.", sec.techName,
                          tab.title))
            _check_common(sec, tab.title, add)
            if not sec.repeatingSectionGrid:
                add(Issue("section-empty", "warning", f"Sekcja „{sec.title}” jest pusta.", sec.techName, tab.title))
            if q.x + q.cols > 3:
                add(Issue("grid-overflow", "error", f"Sekcja {sec.techName} wychodzi poza siatkę 3 kolumn.",
                          sec.techName, tab.title))
            for child in sec.repeatingSectionGrid:
                f = child.field
                all_ids.append(f.id)
                tech_names.append(f.techName)
                if child.x + child.cols > 3:
                    add(Issue("grid-overflow", "error", f"Pole {f.techName} wychodzi poza siatkę 3 kolumn.",
                              f.techName, tab.title))
                if f.type in SECTION_TYPES:
                    add(Issue("nested-section", "error",
                              f"Sekcja {f.techName} jest zagnieżdżona w sekcji {sec.techName} – COI tego nie pozwala.",
                              f.techName, tab.title))
                    continue
                _check_common(f, tab.title, add)
                _check_field(f, tab.title, tab.type == "FINISH", add)

    for name, n in Counter(tech_names).items():
        if not name:
            add(Issue("techname-missing", "error", f"{n} element(ów) nie ma nazwy technicznej (techName)."))
        elif n > 1:
            add(Issue("techname-duplicate", "error", f"Nazwa techniczna „{name}” występuje {n} razy.", name))
    for i, n in Counter(all_ids).items():
        if n > 1:
            add(Issue("id-duplicate", "error", f"Identyfikator {i} występuje {n} razy."))

    tab_ids = {t.id for t in form.tabs}
    for link in form.flow.links:
        if link.source not in tab_ids or link.target not in tab_ids:
            add(Issue("flow-dangling", "error", f"Połączenie stron {link.id} wskazuje nieistniejącą stronę."))
    if len(form.tabs) >= 2 and not form.flow.links:
        add(Issue("flow-missing", "error", "Strony nie są połączone warunkami przepływu (flow.links)."))
    return out


def _check_common(f: Field_, tab_title: str, add) -> None:
    if not _is_uuid(f.id):
        add(Issue("id-not-uuid", "warning", f"Identyfikator {f.techName} nie jest UUID.", f.techName, tab_title))
    if f.techName and not TECHNAME_RE.match(f.techName):
        add(Issue("techname-format", "error",
                  f"Nazwa techniczna „{f.techName}” może zawierać tylko małe litery bez polskich znaków, cyfry i _.",
                  f.techName, tab_title))
    for st in f.states:
        if st.type not in {"SHOW", "READ_ONLY"}:
            add(Issue("state-type", "error", f"Nieznany typ stanu {st.type} w {f.techName}.", f.techName, tab_title))
        if f.type in SECTION_TYPES and st.type != "SHOW":
            add(Issue("state-type", "error", f"Sekcja {f.techName} może mieć tylko stan SHOW.", f.techName, tab_title))
        if not st.query.strip():
            add(Issue("state-query-empty", "error", f"Stan w {f.techName} nie ma warunku.", f.techName, tab_title))
        elif not parse_query(st.query):
            add(Issue("state-query-unknown", "info", f"Warunek w {f.techName} ma nietypową postać – sprawdź ręcznie.",
                      f.techName, tab_title))


def _check_field(f: Field_, tab_title: str, on_finish: bool, add) -> None:
    t = FieldType(f.type)
    if on_finish and t in INPUT_TYPES:
        add(Issue("finish-input", "error", f"Strona końcowa zawiera pole do wprowadzania danych ({t}: {f.techName}).",
                  f.techName, tab_title))
    elif on_finish and t != FieldType.INFO_SECTION:
        add(Issue("finish-not-info", "info",
                  f"Na stronie końcowej reguły dopuszczają tylko INFO_SECTION ({t}: {f.techName}); wzorce COI "
                  "używają TEXT_BLOCK – zostawiamy jak we wzorcach.", f.techName, tab_title))

    if f.dictionaryName:
        if t not in DICTIONARY_TYPES:
            add(Issue("dictionary-type", "error",
                      f"Słownik można podpiąć tylko do SELECT/RADIO/CHECKBOX (pole {f.techName} to {t}).",
                      f.techName, tab_title))
        if f.options:
            add(Issue("dictionary-options", "error", f"Pole {f.techName} korzysta ze słownika – „options” musi być "
                                                     "puste.", f.techName, tab_title))
    elif t in DICTIONARY_TYPES and not f.options:
        add(Issue("options-missing", "error", f"Pole wyboru {f.techName} nie ma opcji ani słownika.", f.techName,
                  tab_title))

    if f.defaultValueType == "EXTERNAL_SYSTEM" and not f.readOnly and t != FieldType.TEXT_FIELD:
        add(Issue("prefill-readonly", "warning", f"Pole {f.techName} z danymi inicjalnymi powinno być tylko do "
                                                 "odczytu.", f.techName, tab_title))

    if t in INPUT_TYPES and t != FieldType.CONSENT_SECTION and "validation" not in f.model_fields_set:
        add(Issue("validation-missing", "error", f"Pole {f.techName} nie ma atrybutu obligatoryjności (validation).",
                  f.techName, tab_title))
    for v in f.validators:
        if v not in VALIDATORS:
            add(Issue("validator-unknown", "error", f"Nieznany walidator {v} w polu {f.techName}.", f.techName,
                      tab_title))
    if t == FieldType.CONSENT_SECTION:
        cfg = (f.model_extra or {}).get("consentSectionConfig") or {}
        if not cfg.get("consents"):
            add(Issue("consent-empty", "error", f"Sekcja zgód {f.techName} nie ma żadnej zgody.", f.techName,
                      tab_title))
    if t == FieldType.INFO_SECTION and not f.description.strip():
        add(Issue("info-description", "error", f"Sekcja informacyjna {f.techName} musi mieć opis.", f.techName,
                  tab_title))
