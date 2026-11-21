"""Mapowanie JSON COI (+ meta) ↔ model frontendu `FormSchema` (frontend/src/types/form.ts) – jedno miejsce.

Zapis z edytora (PUT /drafts/{id}) NIE odtwarza COI z frontendu od zera: bierzemy ostatnią wersję COI jako bazę
i nakładamy na nią zmiany (po techName). Dzięki temu round-trip jest bezstratny – klucze COI, których front
nie zna (consentSectionConfig, multiLevelTree, siatka…), zostają nietknięte.
"""

import copy
import re
from html import unescape
from typing import Any

from app.coi.builder import _html, slugify
from app.coi.jsonata import parse_query, show_query

TYPE_TO_FRONT = {
    "TEXTAREA": "textarea",
    "NUMBER": "number",
    "DATEPICKER": "date",
    "SELECT": "select",
    "RADIO": "radio",
    "CHECKBOX": "checkbox",
    "FILE_UPLOADER": "fileUpload",
    "TEXT_BLOCK": "textBlock",
    "INFO_SECTION": "infoSection",
    "CONSENT_SECTION": "consent",
}
VALIDATOR_TYPES = {"PESEL": "pesel", "ZIP_CODE": "postalCode", "EMAIL": "email", "NIP": "nip", "REGON": "regon"}
FRONT_TO_COI: dict[str, tuple[str, str | None]] = {
    "text": ("TEXT_FIELD", None),
    "textarea": ("TEXTAREA", None),
    "number": ("NUMBER", None),
    "date": ("DATEPICKER", None),
    "select": ("SELECT", None),
    "radio": ("RADIO", None),
    "checkbox": ("CHECKBOX", None),
    "fileUpload": ("FILE_UPLOADER", None),
    "textBlock": ("TEXT_BLOCK", None),
    "infoSection": ("INFO_SECTION", None),
    "consent": ("CONSENT_SECTION", None),
    "pesel": ("TEXT_FIELD", "PESEL"),
    "postalCode": ("TEXT_FIELD", "ZIP_CODE"),
    "email": ("TEXT_FIELD", "EMAIL"),
    "nip": ("TEXT_FIELD", "NIP"),
    "regon": ("TEXT_FIELD", "REGON"),
    "phone": ("TEXT_FIELD", None),
}
TYPE_VALIDATORS = {v for _, v in FRONT_TO_COI.values() if v}
_TAGS = re.compile(r"<[^>]+>")


def strip_html(html: str | None) -> str:
    if not html:
        return ""
    text = _TAGS.sub(" ", html.replace("</p>", "\n"))
    return re.sub(r"[ \t]+", " ", unescape(text)).strip()


def _validators(f: dict[str, Any]) -> list[str]:
    v = f.get("validation")
    return list(v) if isinstance(v, list) else []


def front_type(f: dict[str, Any]) -> str:
    t = f.get("type", "TEXT_FIELD")
    if t != "TEXT_FIELD":
        return TYPE_TO_FRONT.get(t, "text")
    for v in _validators(f):
        if v in VALIDATOR_TYPES:
            return VALIDATOR_TYPES[v]
    if "telefon" in f.get("techName", ""):
        return "phone"
    return "text"


def _visible_if(states: list[dict[str, Any]] | None) -> dict[str, Any] | None:
    for st in states or []:
        if st.get("type") != "SHOW":
            continue
        refs = parse_query(st.get("query", ""))
        if len(refs) == 1 and not refs[0].negated:
            return {"fieldId": refs[0].field_tech, "equals": refs[0].value}
    return None


def _prefill(f: dict[str, Any]) -> dict[str, str] | None:
    dv = f.get("defaultValue")
    if f.get("defaultValueType") == "EXTERNAL_SYSTEM" and isinstance(dv, str) and "." in dv:
        source = dv.split(".", 1)[0]
        if source in {"MLPZ", "PESEL", "PESEL_ADDRESS"}:
            return {"source": source, "key": dv}
    return None


def field_to_front(f: dict[str, Any], section: dict[str, Any], meta: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": f["techName"],
        "label": f.get("title") or "",
        "type": front_type(f),
        "required": "REQUIRED" in _validators(f),
        "section": {"techName": section["techName"], "title": section.get("title", "")},
    }
    help_text = strip_html(f.get("description"))
    if help_text:
        out["helpText"] = help_text
    if f.get("options"):
        out["options"] = [{"value": o.get("name") or o["id"], "label": o.get("name") or o["id"]} for o in f["options"]]
    if f.get("dictionaryName"):
        out["dictionaryId"] = f["dictionaryName"]
    if p := _prefill(f):
        out["prefill"] = p
    vis = _visible_if(f.get("states")) or _visible_if(section.get("states"))
    if vis:
        out["visibleIf"] = vis
    lb = (meta or {}).get("legalBasis")
    if lb and lb.get("quote"):
        out["legalBasis"] = {k: v for k, v in lb.items() if v is not None}
    return out


def coi_to_front(coi: dict[str, Any], meta: dict[str, dict[str, Any]], schema_id: str, version: int,
                 source_file: str) -> dict[str, Any]:
    issuer = ""
    pages: list[dict[str, Any]] = []
    for tab in coi.get("tabs", []):
        if tab.get("type") == "FINISH":
            continue  # podsumowanie robi frontend
        fields = []
        for q in tab.get("questions", []):
            sec = q["field"]
            for c in sec.get("repeatingSectionGrid") or []:
                f = c["field"]
                if f.get("techName") in {"nazwa_urzedu", "nazwa_organu"} and isinstance(f.get("defaultValue"), str):
                    issuer = f["defaultValue"]
                fields.append(field_to_front(f, sec, meta.get(f.get("techName", ""), {})))
        pages.append({"id": tab["id"], "title": tab["title"], "fields": fields})
    return {
        "id": schema_id,
        "version": version,
        "title": coi.get("title", ""),
        "issuer": issuer or "Urząd",
        "sourceFile": source_file,
        "pages": pages,
    }


# --------------------------------------------------------------------------------------------- front → COI


def _locate(coi: dict[str, Any]) -> dict[str, tuple[dict, dict, dict]]:
    """techName → (zakładka, sekcja, pole) dla pól wewnątrz sekcji."""
    out = {}
    for tab in coi.get("tabs", []):
        for q in tab.get("questions", []):
            sec = q["field"]
            for c in sec.get("repeatingSectionGrid") or []:
                out[c["field"].get("techName", "")] = (tab, sec, c["field"])
    return out


def apply_front_schema(base_coi: dict[str, Any], base_meta: dict[str, dict[str, Any]],
                       schema: dict[str, Any]) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    coi = copy.deepcopy(base_coi)
    meta = copy.deepcopy(base_meta)
    edited = {f["id"]: f for p in schema.get("pages", []) for f in p.get("fields", [])}
    coi["title"] = schema.get("title") or coi.get("title", "")
    where = _locate(coi)

    # 1) usunięte pola (poza stroną końcową, której front nie pokazuje)
    for tab in coi.get("tabs", []):
        if tab.get("type") == "FINISH":
            continue
        for q in tab.get("questions", []):
            grid = q["field"].get("repeatingSectionGrid") or []
            kept = [c for c in grid if c["field"].get("techName") in edited]
            if len(kept) != len(grid):
                for i, c in enumerate(kept):
                    c["field"]["questionOrder"] = i
                    c["y"] = i
                q["field"]["repeatingSectionGrid"] = kept
        kept_q = [q for q in tab.get("questions", []) if q["field"].get("repeatingSectionGrid")]
        if len(kept_q) != len(tab.get("questions", [])):
            y = 0
            for q in kept_q:  # jak we wzorcach COI: questionOrder sekcji = jej y w siatce
                q["y"] = q["field"]["questionOrder"] = y
                y += q.get("rows", 2)
        tab["questions"] = kept_q
    for tech in set(meta) - set(edited):
        meta.pop(tech, None)

    # 2) zmiany pól
    for tech, ef in edited.items():
        if tech not in where:
            continue
        tab, sec, f = where[tech]
        before = field_to_front(f, sec, base_meta.get(tech, {}))
        if ef.get("label", before["label"]) != before["label"]:
            f["title"] = ef["label"]
        if (ef.get("helpText") or "") != (before.get("helpText") or ""):
            f["description"] = _html(ef.get("helpText") or "")
        if ef.get("type") and ef["type"] != before["type"]:
            coi_type, validator = FRONT_TO_COI.get(ef["type"], ("TEXT_FIELD", None))
            f["type"] = coi_type
            vals = [v for v in _validators(f) if v not in TYPE_VALIDATORS]
            if validator:
                vals.append(validator)
            f["validation"] = vals
            if coi_type not in {"SELECT", "RADIO", "CHECKBOX"}:
                f["options"] = []
                f.pop("dictionaryName", None)
        if bool(ef.get("required")) != before["required"]:
            vals = [v for v in _validators(f) if v != "REQUIRED"]
            f["validation"] = (["REQUIRED"] if ef.get("required") else []) + vals
        if "options" in ef and ef.get("options") != before.get("options"):
            f["options"] = [{"id": o["label"], "name": o["label"], "techName": slugify(o["label"])}
                            for o in ef["options"] or []]
        if ef.get("visibleIf") != before.get("visibleIf"):
            f["states"] = [s for s in f.get("states") or [] if s.get("type") != "SHOW"]
            vis = ef.get("visibleIf")
            if vis:
                target = where.get(vis["fieldId"])
                # nieistniejące pole zostawiamy w warunku – linter static-graph je wyłapie
                t_tab, t_sec = (target[0]["title"], target[1]["techName"]) if target else (tab["title"], "?")
                f["states"].append({"type": "SHOW", "query": show_query(str(vis["equals"]), t_tab, t_sec,
                                                                        vis["fieldId"])})
        if ef.get("legalBasis") != before.get("legalBasis"):
            m = meta.setdefault(tech, {"key": tech, "confidence": 1.0, "source": "edytor", "needsReview": False})
            m["legalBasis"] = ef.get("legalBasis")
    return coi, meta
