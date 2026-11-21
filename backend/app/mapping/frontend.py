import copy

from app import dictionaries
from app.coi.builder import flow_for, option_list
from app.coi.jsonata import parse, references, show_query
from app.coi.walk import children, leaves

TYPE_TO_FRONT = {
    "TEXTAREA": "textarea",
    "NUMBER": "number",
    "DATEPICKER": "date",
    "SELECT": "select",
    "RADIO": "radio",
    "CHECKBOX": "checkbox",
}
FRONT_TO_TYPE = {
    "text": ("TEXT_FIELD", None),
    "textarea": ("TEXTAREA", None),
    "number": ("NUMBER", None),
    "date": ("DATEPICKER", None),
    "select": ("SELECT", None),
    "radio": ("RADIO", None),
    "checkbox": ("CHECKBOX", None),
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


def _options(field: dict) -> list[dict] | None:
    if field.get("dictionaryName"):
        entry = dictionaries.get(field["dictionaryName"])
        values = entry["values"] if entry else []
        return [{"value": v["id"], "label": v["name"]} for v in values] or None
    options = field.get("options") or []
    return [{"value": o.get("id") or o.get("name"), "label": o.get("name") or o.get("id")} for o in options] or None


def to_frontend(coi: dict, meta: dict, *, schema_id: str, version: int, issuer: str, source_file: str) -> dict:
    conds = conditions(coi)
    pages = []
    for tab in coi.get("tabs", []):
        if tab.get("type") == "FINISH":
            continue
        fields = []
        for question in tab.get("questions") or []:
            for child in children(question.get("field") or {}):
                field = child.get("field") or {}
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
            pages.append({"id": tab["id"], "title": tab.get("title", ""), "fields": fields})
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
    return coi, meta
