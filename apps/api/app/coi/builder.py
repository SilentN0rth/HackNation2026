import copy
import json
import uuid
from functools import lru_cache
from pathlib import Path

from app.coi.jsonata import show_query
from app.coi.walk import CHOICE_TYPES, iter_fields
from app.config import get_settings
from app.understand.model import FieldIR, FormIR
from app.understand.text import slug

TEMPLATE = Path(__file__).parent / "templates" / "standard.json"
DATA_TAB = "Dane"
CONTACT_TAB = "Kontakt i zgody"
FINISH_TAB = "Strona końcowa"
ISSUER_FIELDS = {"nazwa_urzedu", "nazwa_organu"}
ORGAN_PREFIXES = ("wójt", "prezydent", "burmistrz", "starosta", "marszałek", "wojewoda", "dyrektor", "rada", "zarząd")
CLAUSE_PLACEHOLDER = "{{CLAUSE_LINK}}"
CLAUSE_TEXT = "klauzulą informacyjną"
NO_REQUIRED = {"TEXT_BLOCK", "INFO_SECTION", "CONSENT_SECTION", "SECTION", "REPEATING_SECTION"}


@lru_cache
def _template() -> dict:
    return json.loads(TEMPLATE.read_text(encoding="utf-8"))


def clause_link(url: str) -> str:
    """Odnośnik do klauzuli informacyjnej; bez adresu zostaje sam tekst (nie wstawiamy martwego linku)."""
    if not url:
        return f"{CLAUSE_TEXT} urzędu"
    safe = url.replace('"', "%22")
    return (
        f'<a href="{safe}" target="_blank" rel="noopener noreferrer" '
        f'aria-label="Link otwiera się w nowej karcie">{CLAUSE_TEXT}</a>'
    )


def _apply_clause(tabs: list[dict], url: str) -> None:
    link = clause_link(url)
    for item in iter_fields({"tabs": tabs}):
        config = item.field.get("consentSectionConfig") or {}
        for consent in config.get("consents") or []:
            consent["description"] = (consent.get("description") or "").replace(CLAUSE_PLACEHOLDER, link)


def new_id() -> str:
    return str(uuid.uuid4())


def make_field(
    type_: str,
    tech_name: str,
    title: str,
    *,
    description: str = "",
    options: list[dict] | None = None,
    validation: list[str] | None = None,
    read_only: bool = False,
    children: list[dict] | None = None,
    states: list[dict] | None = None,
    order: int = 0,
    tooltip: str = "",
    dictionary: str | None = None,
) -> dict:
    field = {
        "id": new_id(),
        "type": type_,
        "techName": tech_name,
        "title": " ".join(title.split()),
        "description": description.strip(),
        "options": options or [],
        "validation": validation or [],
        "readOnly": read_only,
        "repeatingSectionGrid": children or [],
        "states": states or [],
        "questionOrder": order,
        "tooltipMessage": tooltip,
    }
    if dictionary:
        field["dictionaryName"] = dictionary
        field["options"] = []
    return field


def cell(field: dict, y: int, rows: int = 1) -> dict:
    return {"x": 0, "y": y, "rows": rows, "cols": 3, "field": field}


class Names:
    def __init__(self, reserved: set[str]):
        self.used = set(reserved)

    def take(self, text: str) -> str:
        base = slug(text)
        name, n = base, 2
        while name in self.used:
            name = f"{base}_{n}"
            n += 1
        self.used.add(name)
        return name


def option_list(values: list[str]) -> list[dict]:
    seen: set[str] = set()
    result = []
    for value in values:
        value = " ".join(value.replace('"', "”").split())
        if not value or value in seen:
            continue
        seen.add(value)
        tech, n = slug(value), 2
        existing = {o["techName"] for o in result}
        while tech in existing:
            tech = f"{slug(value)}_{n}"
            n += 1
        result.append({"id": value, "name": value, "techName": tech})
    return result


def _consent_html(text: str) -> str:
    escaped = text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f"<html><head></head><body><p>{escaped}</p></body></html>"


def _field_from_ir(item: FieldIR, tech_name: str, order: int) -> dict:
    if item.type == "CONSENT_SECTION":
        field = make_field("CONSENT_SECTION", tech_name, "", order=order)
        field["consentSectionConfig"] = {
            "consents": [{"description": _consent_html(text), "required": True} for text in item.options],
            "selectAllEnabled": len(item.options) > 1,
            "files": [],
        }
        return field
    validation = []
    if item.required and item.type not in NO_REQUIRED:
        validation.append("REQUIRED")
    validation += [v for v in item.validation if v != "REQUIRED"]
    options = option_list(item.options) if item.type in CHOICE_TYPES and not item.dictionary else []
    return make_field(
        item.type,
        tech_name,
        item.title,
        description=item.description,
        options=options,
        validation=validation,
        order=order,
        tooltip=item.tooltip,
        dictionary=item.dictionary if item.type in CHOICE_TYPES else None,
    )


def _refresh_ids(tabs: list[dict]) -> None:
    for tab in tabs:
        tab["id"] = new_id()
        for question in tab["questions"]:
            question["field"]["id"] = new_id()
            for child in question["field"].get("repeatingSectionGrid") or []:
                child["field"]["id"] = new_id()


def flow_for(tabs: list[dict]) -> dict:
    return {
        "links": [
            {"id": new_id(), "source": tabs[i]["id"], "target": tabs[i + 1]["id"]}
            for i in range(len(tabs) - 1)
        ]
    }


def build(form: FormIR, issuer: str | None = None) -> tuple[dict, dict]:
    template = copy.deepcopy(_template())
    by_title = {tab["title"]: tab for tab in template["tabs"]}
    data_tab, contact_tab, finish_tab = by_title[DATA_TAB], by_title[CONTACT_TAB], by_title[FINISH_TAB]
    issuer_name = issuer or form.issuer or get_settings().default_issuer
    is_organ = issuer_name.lower().startswith(ORGAN_PREFIXES)
    for item in iter_fields({"tabs": [data_tab]}):
        if item.field.get("techName") in ISSUER_FIELDS:
            item.field["defaultValue"] = issuer_name
            if is_organ:
                item.field.update(techName="nazwa_organu", title="Nazwa organu")
                item.section["title"] = "Organ, do którego jest składany wniosek"
                item.section["techName"] = "organ_do_ktorego_jest_skladany_wniosek"

    _apply_clause([data_tab, contact_tab, finish_tab], get_settings().clause_url)
    reserved = {item.field["techName"] for item in iter_fields({"tabs": [data_tab, contact_tab, finish_tab]})}
    names = Names(reserved)
    tabs_by_key: dict[str, tuple[dict, dict, dict]] = {}
    pending: list[tuple[FieldIR, dict]] = []
    meta: dict[str, dict] = {}
    middle: list[dict] = []
    used_tab_titles = {DATA_TAB.lower(), CONTACT_TAB.lower(), FINISH_TAB.lower()}

    for page in form.pages:
        title = page.title
        n = 2
        while title.lower() in used_tab_titles:
            title = f"{page.title} ({n})"
            n += 1
        used_tab_titles.add(title.lower())
        tab = {"id": new_id(), "title": title, "type": "MAIN", "questions": []}
        y = 0
        for section_order, section in enumerate(page.sections):
            section_field = make_field("SECTION", names.take(section.title), section.title, order=section_order)
            children: list[dict] = []
            for order, item in enumerate(section.fields):
                field = _field_from_ir(item, names.take(item.title or ("zgoda" if item.type == "CONSENT_SECTION" else "pole")), order)
                children.append(cell(field, order))
                tabs_by_key[item.key] = (tab, section_field, field)
                meta[field["id"]] = {
                    "techName": field["techName"],
                    "source": item.source,
                    "page": item.page,
                    "confidence": form.ocr_confidence,
                }
                if item.condition:
                    pending.append((item, field))
            section_field["repeatingSectionGrid"] = children
            rows = max(2, len(children) + 1)
            tab["questions"].append(cell(section_field, y, rows))
            y += rows
        middle.append(tab)

    for item, field in pending:
        target = tabs_by_key.get(item.condition.field_key)
        if not target:
            continue
        tab, section_field, target_field = target
        field["states"].append(
            {
                "type": "SHOW",
                "query": show_query(item.condition.equals, tab["title"], section_field["techName"], target_field["techName"]),
            }
        )
        meta[field["id"]]["condition"] = {"fieldId": target_field["id"], "equals": item.condition.equals}

    tabs = [data_tab, *middle, contact_tab, finish_tab]
    _refresh_ids([data_tab, contact_tab, finish_tab])
    coi = {"title": form.title[:255], "tabs": tabs, "flow": flow_for(tabs)}
    return coi, meta
