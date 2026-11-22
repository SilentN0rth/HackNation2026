import copy
import html
import re

from app import dictionaries
from app.coi.builder import flow_for, option_list
from app.coi.jsonata import _escape_name, parse, parse_expr, references, show_query
from app.coi.walk import children, iter_fields, leaves

TYPE_TO_FRONT = {
    "TEXTAREA": "textarea",
    "NUMBER": "number",
    "DATEPICKER": "date",
    "SELECT": "select",
    "RADIO": "radio",
    "CHECKBOX": "checkbox",
    "FILE_UPLOADER": "file",
}
FRONT_TO_TYPE = {
    "text": ("TEXT_FIELD", None),
    "textarea": ("TEXTAREA", None),
    "number": ("NUMBER", None),
    "date": ("DATEPICKER", None),
    "select": ("SELECT", None),
    "radio": ("RADIO", None),
    "checkbox": ("CHECKBOX", None),
    "file": ("FILE_UPLOADER", None),
    "pesel": ("TEXT_FIELD", "PESEL"),
    "postalCode": ("TEXT_FIELD", "ZIP_CODE"),
    "email": ("TEXT_FIELD", "EMAIL"),
    "phone": ("TEXT_FIELD", None),
}
TYPE_VALIDATORS = {"PESEL", "ZIP_CODE", "EMAIL"}
LABELS = {
    "TERYT_DOWODOWY": "Województwo, powiat i gmina",
    "TERYT_4G_DOWODOWY": "Województwo, powiat, gmina i miejscowość",
}


def consent_text(description: str) -> str:
    """Treść zgody bez znaczników HTML (frontend pokazuje zwykły tekst)."""
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", description or "")).split())


def consent_items(field: dict) -> list[dict]:
    """Sekcja zgód COI -> osobne, wymagane pola wyboru dla obywatela (id = id sekcji + numer zgody)."""
    config = field.get("consentSectionConfig") or {}
    return [
        {"id": f"{field['id']}#{index}", "label": consent_text(c.get("description", "")), "type": "checkbox", "required": bool(c.get("required"))}
        for index, c in enumerate(config.get("consents") or [])
        if consent_text(c.get("description", ""))
    ]


def front_type(field: dict) -> str | None:
    kind = field.get("type")
    validation = set(field.get("validation") or [])
    if kind == "TEXT_FIELD":
        if "PESEL" in validation:
            return "pesel"
        if "ZIP_CODE" in validation:
            return "postalCode"
        if "EMAIL" in validation:
            return "email"
        if "telefon" in (field.get("techName") or ""):
            return "phone"
        return "text"
    return TYPE_TO_FRONT.get(kind)


def _index(coi: dict) -> dict[tuple[str, str, str], dict]:
    return {
        (item.tab.get("title"), item.section.get("techName"), item.field.get("techName")): item.field
        for item in leaves(coi)
    }


def conditions(coi: dict) -> dict[str, tuple[str, str, bool]]:
    index = _index(coi)
    result: dict[str, tuple[str, str, bool]] = {}
    for item in leaves(coi):
        for state in item.field.get("states") or []:
            if state.get("type") != "SHOW":
                continue
            ref = parse(state.get("query", "")) or next(iter(references(state.get("query", ""))), None)
            if ref:
                target = index.get((ref.tab, ref.section, ref.field))
                if target:
                    result[item.field["id"]] = (target["id"], ref.value, ref.negated)
    return result


def _condition(node, index: dict, negate: bool = False) -> dict | None:
    """Zamienia drzewo z `parse_expr` na warunek frontendu (atom, allOf, anyOf)."""
    kind = node[0]
    if kind == "atom":
        ref = node[1]
        target = index.get((ref.tab, ref.section, ref.field))
        if not target:
            return None
        return {"fieldId": target["id"], "equals": ref.value, **({"negate": True} if negate else {})}
    if kind == "not":
        return _condition(node[1], index, not negate)
    parts = [_condition(child, index, negate) for child in node[1]]
    all_of = (kind == "and") != negate
    if any(part is None for part in parts):
        if all_of:
            parts = [part for part in parts if part is not None]
        else:
            return None
    if not parts:
        return None
    return parts[0] if len(parts) == 1 else {"allOf" if all_of else "anyOf": parts}


def section_visibility(coi: dict) -> dict[str, dict]:
    """Warunki widoczności całych sekcji, przypisane każdemu polu w sekcji (id pola -> warunek)."""
    index = _index(coi)
    result: dict[str, dict] = {}
    for located in iter_fields(coi):
        if located.section is not None:
            continue
        section = located.field
        parts = []
        for state in section.get("states") or []:
            if state.get("type") != "SHOW":
                continue
            tree = parse_expr(state.get("query", ""))
            cond = _condition(tree, index) if tree else None
            if cond:
                parts.append(cond)
        if not parts:
            continue
        cond = parts[0] if len(parts) == 1 else {"allOf": parts}
        for child in children(section):
            result[child["field"]["id"]] = cond
    return result


def _read_only_condition(field: dict, index: dict) -> dict | None:
    """Stan READ_ONLY powiązany z polem wyboru (np. „Brak nazwy ulicy”): pole blokuje się po zaznaczeniu."""
    for state in field.get("states") or []:
        if state.get("type") != "READ_ONLY":
            continue
        tree = parse_expr(state.get("query", ""))
        if tree and tree[0] == "atom":
            target = index.get((tree[1].tab, tree[1].section, tree[1].field))
            if target and target.get("type") == "CHECKBOX":
                return {"fieldId": target["id"], "equals": True}
    return None


def _page_condition(tab: dict, index: dict) -> dict | None:
    """Warunek widoczności całej strony, gdy wszystkie jej sekcje mają ten sam prosty warunek SHOW."""
    found = []
    for question in tab.get("questions") or []:
        states = [x for x in (question.get("field") or {}).get("states") or [] if x.get("type") == "SHOW"]
        tree = parse_expr(states[0].get("query", "")) if len(states) == 1 else None
        if not tree or tree[0] != "atom":
            return None
        cond = _condition(tree, index)
        if not cond or "negate" in cond:
            return None
        found.append(cond)
    return found[0] if found and all(c == found[0] for c in found) else None


def _options(field: dict) -> list[dict] | None:
    if field.get("dictionaryName"):
        entry = dictionaries.get(field["dictionaryName"])
        values = entry["values"] if entry else []
        return [{"value": v["id"], "label": v["name"]} for v in values] or None
    options = field.get("options") or []
    return [{"value": o.get("id") or o.get("name"), "label": o.get("name") or o.get("id")} for o in options] or None


def to_frontend(coi: dict, meta: dict, *, schema_id: str, version: int, issuer: str, source_file: str) -> dict:
    conds = conditions(coi)
    section_conds = section_visibility(coi)
    index_all = _index(coi)
    pages = []
    for tab in coi.get("tabs", []):
        if tab.get("type") == "FINISH":
            continue
        fields = []
        for question in tab.get("questions") or []:
            for child in children(question.get("field") or {}):
                field = child.get("field") or {}
                if field.get("type") == "CONSENT_SECTION":
                    fields.extend(consent_items(field))
                    continue
                kind = front_type(field)
                if kind is None:
                    continue
                item: dict = {
                    "id": field["id"],
                    "label": LABELS.get(field.get("title") or "", field.get("title") or field.get("techName") or "Pole"),
                    "type": kind,
                    "required": "REQUIRED" in (field.get("validation") or []),
                }
                if field.get("tooltipMessage"):
                    item["helpText"] = field["tooltipMessage"]
                options = _options(field)
                if kind in ("select", "radio") and options:
                    item["options"] = options
                if field.get("dictionaryName"):
                    item["dictionaryId"] = field["dictionaryName"]
                if field.get("defaultValueType") == "EXTERNAL_SYSTEM" and isinstance(field.get("defaultValue"), str):
                    item["prefill"] = {"source": "mObywatel", "key": field["defaultValue"]}
                if field["id"] in conds:
                    target, value, negated = conds[field["id"]]
                    item["visibleIf"] = {"fieldId": target, "equals": value, **({"negate": True} if negated else {})}
                lock = _read_only_condition(field, index_all)
                if lock:
                    item["readOnlyIf"] = lock
                if field["id"] in section_conds:
                    item["visibleWhen"] = section_conds[field["id"]]
                default = field.get("defaultValue")
                if field.get("defaultValueType") != "EXTERNAL_SYSTEM" and default:
                    item["defaultValue"] = default[0] if isinstance(default, list) else str(default)
                if field.get("readOnly"):
                    item["readOnly"] = True
                legal = (meta.get(field["id"]) or {}).get("legalBasis")
                if legal:
                    item["legalBasis"] = legal
                fields.append(item)
        if fields:
            page = {"id": tab["id"], "title": tab.get("title", ""), "fields": fields}
            shared = _page_condition(tab, index_all)
            if shared:
                page["visibleIf"] = shared
            pages.append(page)
    return {
        "id": schema_id,
        "version": version,
        "title": coi.get("title", ""),
        "issuer": issuer,
        "sourceFile": source_file,
        "pages": pages,
    }


def exposed_ids(coi: dict) -> set[str]:
    return {item.field["id"] for item in leaves(coi) if front_type(item.field) is not None}


def _replaceable(state: dict) -> bool:
    if state.get("type") != "SHOW":
        return False
    return bool(parse(state.get("query", "")) or references(state.get("query", "")))


def from_frontend(coi: dict, meta: dict, schema: dict) -> tuple[dict, dict]:
    coi = copy.deepcopy(coi)
    meta = copy.deepcopy(meta)
    conds = conditions(coi)
    initial = dict(conds)
    original = set(conds)
    renamed = False
    renames: dict[str, str] = {}
    known = exposed_ids(coi)
    cells = {item.field["id"]: item for item in leaves(coi)}
    tabs_by_id = {tab["id"]: tab for tab in coi.get("tabs", [])}
    kept: set[str] = set()
    titles = {tab.get("title") for tab in coi.get("tabs", [])}

    for page in schema.get("pages", []):
        tab = tabs_by_id.get(page.get("id"))
        new_title = (page.get("title") or "").strip()
        if tab and new_title and new_title != tab.get("title") and new_title not in titles:
            titles.discard(tab.get("title"))
            renames[tab.get("title")] = new_title
            tab["title"] = new_title
            renamed = True
            titles.add(new_title)
        for incoming in page.get("fields", []):
            located = cells.get(incoming.get("id"))
            if located is None:
                continue
            kept.add(incoming["id"])
            field = located.field
            label = (incoming.get("label") or "").strip()
            if label and label != LABELS.get(field.get("title") or ""):
                field["title"] = label
            field["tooltipMessage"] = incoming.get("helpText") or ""
            kind, type_validator = FRONT_TO_TYPE.get(incoming.get("type"), (field.get("type"), None))
            field["type"] = kind
            previous = field.get("validation") if isinstance(field.get("validation"), list) else []
            validation = [v for v in previous if v not in TYPE_VALIDATORS and v != "REQUIRED"]
            if incoming.get("required"):
                validation.insert(0, "REQUIRED")
            if type_validator:
                validation.append(type_validator)
            elif front_type(field) in ("pesel", "postalCode", "email") and incoming.get("type") == front_type(field):
                validation += [v for v in previous if v in TYPE_VALIDATORS]
            if sorted(validation) != sorted(previous):
                field["validation"] = validation
            if kind in ("SELECT", "RADIO", "CHECKBOX") and not field.get("dictionaryName"):
                labels = [o.get("label") or o.get("value") for o in incoming.get("options") or []]
                current = [o.get("name") or o.get("id") for o in field.get("options") or []]
                if labels and labels != current:
                    field["options"] = option_list(labels)
            elif kind not in ("SELECT", "RADIO", "CHECKBOX"):
                field["options"] = []
                field.pop("dictionaryName", None)
            visible = incoming.get("visibleIf")
            if visible and visible.get("fieldId"):
                conds[field["id"]] = (visible["fieldId"], str(visible.get("equals", "")), bool(visible.get("negate")))
            else:
                conds.pop(field["id"], None)
            if incoming.get("legalBasis"):
                meta.setdefault(field["id"], {})["legalBasis"] = incoming["legalBasis"]

    removed = known - kept
    for tab in coi.get("tabs", []):
        for question in list(tab.get("questions") or []):
            section = question.get("field") or {}
            grid = [c for c in children(section) if (c.get("field") or {}).get("id") not in removed]
            for order, child in enumerate(sorted(grid, key=lambda c: c.get("y", 0))):
                child["y"] = order
                child["field"]["questionOrder"] = order
            section["repeatingSectionGrid"] = grid
            if not grid:
                tab["questions"].remove(question)
        y = 0
        for question in tab.get("questions") or []:
            question["y"] = y
            y += question.get("rows", 2)
    before = len(coi.get("tabs", []))
    coi["tabs"] = [t for t in coi.get("tabs", []) if t.get("questions") or t.get("type") == "FINISH"]
    if len(coi["tabs"]) != before:
        coi["flow"] = flow_for(coi["tabs"])
    for field_id in removed:
        meta.pop(field_id, None)
        conds.pop(field_id, None)

    location = {
        item.field["id"]: (item.tab.get("title"), item.section.get("techName"), item.field.get("techName"))
        for item in leaves(coi)
    }
    for item in leaves(coi):
        field = item.field
        if field["id"] not in original and field["id"] not in kept:
            continue
        if not renamed and conds.get(field["id"]) == initial.get(field["id"]):
            continue
        states = [s for s in field.get("states") or [] if not _replaceable(s)]
        cond = conds.get(field["id"])
        if cond and cond[0] in location:
            tab_title, section_tech, field_tech = location[cond[0]]
            states.append({"type": "SHOW", "query": show_query(cond[1], tab_title, section_tech, field_tech, cond[2])})
        field["states"] = states
    for old_title, new_title in renames.items():
        before, after = f"tabs['{_escape_name(old_title)}' in title]", f"tabs['{_escape_name(new_title)}' in title]"
        for located in iter_fields(coi):
            for state in located.field.get("states") or []:
                state["query"] = (state.get("query") or "").replace(before, after)
    return coi, meta
