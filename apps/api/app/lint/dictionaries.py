import re

from app.coi.walk import INPUT_TYPES, leaves
from app.dictionaries import suggest
from app.lint.base import Flag

LINTER = "citation-relevance"


def run(coi: dict) -> list[Flag]:
    flags: list[Flag] = []
    for item in leaves(coi):
        field = item.field
        if field.get("type") not in INPUT_TYPES or field.get("dictionaryName"):
            continue
        name = suggest(field.get("title") or "", [o.get("name", "") for o in field.get("options") or []])
        if not name:
            continue
        flags.append(
            Flag(
                f"{LINTER}:{field.get('techName')}:dictionary",
                LINTER,
                "info",
                "Pole może korzystać ze słownika",
                f"Wartości pola „{field.get('title')}” pasują do słownika {name}.",
                item.tab.get("id"),
                field.get("id"),
                suggestion=f"Zmień typ na listę (SELECT) i podepnij słownik {name} zamiast ręcznie wpisywanych opcji.",
            )
        )
    return [f for f in flags if re.match(r"^[\w:-]+$", f.id)]
