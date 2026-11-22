"""Ostrzeżenia jakości formularza COI: rzeczy formalnie poprawne, ale łamiące standardy lub zdrowy rozsądek."""

import re
from collections import Counter

from app.coi import initial_data
from app.coi.initial_data import EXTERNAL_SYSTEM
from app.coi.validator import Issue
from app.coi.walk import INPUT_TYPES, SECTION_TYPES, children
from app.understand.text import is_junk_title

MAX_LABEL = 120
MAX_FIELDS_PER_PAGE = 25
MAX_FIELDS_PER_SECTION = 15
VALIDATOR_BY_LABEL = (
    (re.compile(r"\bpesel\b", re.I), "PESEL", {"TEXT_FIELD"}),
    (re.compile(r"^nip$", re.I), "NIP", {"TEXT_FIELD"}),
    (re.compile(r"\bregon\b", re.I), "REGON", {"TEXT_FIELD"}),
    (re.compile(r"e-?mail", re.I), "EMAIL", {"TEXT_FIELD"}),
    (re.compile(r"^kod pocztowy$", re.I), "ZIP_CODE", {"TEXT_FIELD"}),
)
GENERIC_ORGAN = re.compile(r"^(urząd|wójt|burmistrz|prezydent|starosta|gminy?|miasta?|i|miejski|miejskiego|powiatowy)(\s+(urząd|wójt|burmistrz|prezydent|starosta|gminy?|miasta?|i|miejski|miejskiego|powiatowy))*$", re.I)
GENDERED = re.compile(r"\b(zapoznałem|zapoznałam|oświadczam, że (?:jestem|byłem|byłam)|zobowiązuję się, że będę)\b|\b\w+(?:łem|łam)\b(?=\s+się\b)", re.I)
PARTICIPLE = re.compile(r"\b\w{3,}ąc\b", re.I)
HREF = re.compile(r'href="([^"]*)"')


def _issue(code: str, message: str, tab: dict, item: dict) -> Issue:
    return Issue(code, "warning", message, tab.get("title"), item.get("techName"), item.get("id"), tab.get("id"))


def _title_checks(tab: dict, item: dict, label: str, out: list[Issue]) -> None:
    title = item.get("title") or ""
    if title != " ".join(title.split()):
        out.append(_issue("title-whitespace", f"Etykieta „{label}” ma zbędne spacje lub znaki nowej linii.", tab, item))
    if len(title) > MAX_LABEL:
        out.append(_issue("long-title", f"Etykieta ma {len(title)} znaków (limit {MAX_LABEL}); to zwykle akapit z papieru, a nie pole.", tab, item))
    for option in item.get("options") or []:
        if len(option.get("name") or "") > MAX_LABEL:
            out.append(_issue("long-option", f"Opcja w polu „{label}” ma ponad {MAX_LABEL} znaków.", tab, item))
            break


def _field_checks(tab: dict, item: dict, out: list[Issue]) -> None:
    label = item.get("title") or item.get("techName") or "bez nazwy"
    ftype = item.get("type")
    _title_checks(tab, item, label, out)
    if ftype in INPUT_TYPES and not (item.get("title") or "").strip():
        out.append(_issue("missing-label", "Pole do wypełnienia nie ma etykiety.", tab, item))
    validation = set(item.get("validation") or [])
    for pattern, validator, types in VALIDATOR_BY_LABEL:
        foreign = "zagranica" in (item.get("techName") or "")  # adresy zagraniczne: kod pocztowy bez walidacji kształtu
        if ftype in types and pattern.search(item.get("title") or "") and validator not in validation and not item.get("readOnly") and not (foreign and validator == "ZIP_CODE"):
            out.append(_issue("missing-validator", f"Pole „{label}” powinno mieć walidator {validator}.", tab, item))
    if item.get("defaultValueType") == EXTERNAL_SYSTEM:
        if not item.get("readOnly"):
            out.append(_issue("external-not-readonly", f"Pole „{label}” jest zasilane z rejestru, więc musi być tylko do odczytu.", tab, item))
        problem = initial_data.check(item.get("defaultValue"))
        if problem:
            out.append(_issue("external-bad-source", f"Pole „{label}” ma błędne źródło danych inicjalnych: {problem}.", tab, item))
        elif (ftype == "DATEPICKER") != (item["defaultValue"] in initial_data.DATE_ATTRIBUTES):
            out.append(_issue("external-type-mismatch", f"Typ pola „{label}” nie pasuje do atrybutu {item['defaultValue']} (data tylko w datepickerze).", tab, item))
    if item.get("techName") in ("nazwa_urzedu", "nazwa_organu") and GENERIC_ORGAN.match((item.get("defaultValue") or "").strip()):
        out.append(_issue("organ-name", "Nazwa urzędu nie zawiera nazwy własnej (miejscowości); uzupełnij ją przed publikacją.", tab, item))
    for consent in (item.get("consentSectionConfig") or {}).get("consents") or []:
        plain = re.sub(r"<[^>]+>", " ", consent.get("description") or "")
        if GENDERED.search(plain):
            out.append(_issue("language-gender", "Treść zgody wskazuje płeć (np. „zapoznałem się”); użyj formy neutralnej: „zapoznaję się”.", tab, item))
        if PARTICIPLE.search(plain):
            out.append(_issue("language-participle", "Treść zawiera imiesłów na „-ąc”; standardy zalecają prostsze zdania.", tab, item))
        for href in HREF.findall(consent.get("description") or ""):
            if not re.match(r"https?://", href):
                out.append(_issue("consent-link", f"Odnośnik w zgodzie („{href.strip()}”) nie jest adresem URL.", tab, item))


def quality(coi: dict) -> list[Issue]:
    issues: list[Issue] = []
    if len(coi.get("title") or "") > MAX_LABEL:
        issues.append(Issue("long-title", "warning", "Tytuł formularza powinien być jak najkrótszy."))
    for tab in coi.get("tabs") or []:
        title = (tab.get("title") or "").strip()
        if is_junk_title(title):
            issues.append(_issue("junk-title", f"Tytuł strony „{title}” wygląda na fragment papierowego formularza.", tab, {}))
        count = 0
        for question in tab.get("questions") or []:
            section = question.get("field") or {}
            grid = children(section)
            inputs = [c["field"] for c in grid if (c.get("field") or {}).get("type") in INPUT_TYPES]
            if not section.get("states"):  # sekcje i pola widoczne warunkowo nie obciążają strony od początku
                count += len([f for f in inputs if not f.get("states")])
            if section.get("type") in SECTION_TYPES and len(inputs) > MAX_FIELDS_PER_SECTION:
                issues.append(_issue("heavy-section", f"Sekcja „{section.get('title')}” ma {len(inputs)} pól; podziel ją tematycznie.", tab, section))
            for child in grid:
                _field_checks(tab, child.get("field") or {}, issues)
        if count > MAX_FIELDS_PER_PAGE:
            issues.append(_issue("heavy-page", f"Strona „{title}” ma {count} pól; rozważ podział na tematyczne strony.", tab, {}))
    return issues


def summary(coi: dict) -> dict[str, int]:
    return dict(Counter(issue.code for issue in quality(coi)))
