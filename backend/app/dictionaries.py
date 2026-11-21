import json
from functools import lru_cache
from pathlib import Path

from app.understand.text import fold

PATH = Path(__file__).resolve().parents[1] / "data" / "dictionaries.json"
KEYWORDS = {
    "kraj": "Kraje",
    "państwo": "Kraje",
    "obywatelstwo": "Kraje",
    "województwo": "Województwo",
    "powiat": "Powiat",
    "gmina": "Gmina",
    "numer kierunkowy": "Numery kierunkowe",
    "rasa": "RASY_PSOW_UZNAWANYCH_ZA_AGRESYWNE",
    "dyscyplin": "DYSCYPLINY_SPORTOWE",
}


@lru_cache
def load() -> dict[str, dict]:
    return json.loads(PATH.read_text(encoding="utf-8"))


def listing() -> list[dict]:
    return [
        {
            "name": name,
            "description": item["opis"],
            "proposal": bool(item.get("propozycja")),
            "fieldTypes": item["typyPol"],
            "size": len(item["wartosci"]),
        }
        for name, item in load().items()
    ]


def get(name: str) -> dict | None:
    item = load().get(name)
    if item is None:
        return None
    return {
        "name": name,
        "description": item["opis"],
        "proposal": bool(item.get("propozycja")),
        "fieldTypes": item["typyPol"],
        "values": [{"id": v, "name": v} for v in item["wartosci"]],
    }


def suggest(title: str, options: list[str]) -> str | None:
    lowered = title.lower()
    for keyword, name in KEYWORDS.items():
        if keyword in lowered:
            return name
    folded = {fold(o) for o in options if o}
    if len(folded) < 2:
        return None
    for name, item in load().items():
        values = {fold(v) for v in item["wartosci"]}
        if values and len(folded & values) >= 2:
            return name
    return None
