import re
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

import yaml

PATH = Path(__file__).with_name("catalog.yaml")


@dataclass
class FieldRule:
    pattern: re.Pattern
    type: str | None = None
    validation: list[str] = field(default_factory=list)
    dictionary: str | None = None
    tooltip: str | None = None


@dataclass
class Rewrite:
    pattern: re.Pattern
    title: str
    type: str | None = None


@dataclass
class Gap:
    pattern: re.Pattern
    title: str
    type: str | None = None


@dataclass
class FollowUp:
    pattern: re.Pattern
    title: str
    trim: re.Pattern | None = None
    tooltip: str | None = None


@dataclass
class Catalog:
    skip_lines: list[re.Pattern]
    skip_sections: list[re.Pattern]
    applicant_sections: list[re.Pattern]
    legal_sections: list[re.Pattern]
    attachment_sections: list[re.Pattern]
    statement_sections: list[re.Pattern]
    choice_hints: list[re.Pattern]
    describe_hints: list[re.Pattern]
    conditions: list[re.Pattern]
    issuers: list[re.Pattern]
    titles: list[re.Pattern]
    sensitive: list[re.Pattern]
    standard: list[re.Pattern]
    fields: list[FieldRule]
    rewrites: list[Rewrite]
    gaps: list[Gap]
    follow_ups: list[FollowUp]


def _compile(items: list[str]) -> list[re.Pattern]:
    return [re.compile(p, re.I) for p in items]


def any_match(patterns: list[re.Pattern], text: str) -> bool:
    return any(p.search(text) for p in patterns)


@lru_cache
def catalog() -> Catalog:
    raw = yaml.safe_load(PATH.read_text(encoding="utf-8"))
    return Catalog(
        skip_lines=_compile(raw["pomijane_linie"]),
        skip_sections=_compile(raw["pomijane_sekcje"]),
        applicant_sections=_compile(raw["sekcje_wnioskodawcy"]),
        legal_sections=_compile(raw["sekcje_podstawy_prawnej"]),
        attachment_sections=_compile(raw["sekcje_zalacznikow"]),
        statement_sections=_compile(raw["sekcje_oswiadczen"]),
        choice_hints=_compile(raw["wskazowki_wyboru"]),
        describe_hints=_compile(raw["wskazowki_opisu"]),
        conditions=_compile(raw["warunki"]),
        issuers=_compile(raw["wydawcy"]),
        titles=_compile(raw["tytuly"]),
        sensitive=_compile(raw["wrazliwe"]),
        standard=_compile(raw["dane_standardowe"]),
        fields=[
            FieldRule(
                pattern=re.compile(item["wzorzec"], re.I),
                type=item.get("typ"),
                validation=list(item.get("walidacja", [])),
                dictionary=item.get("slownik"),
                tooltip=item.get("podpowiedz"),
            )
            for item in raw["pola"]
        ],
        rewrites=[
            Rewrite(re.compile(item["wzorzec"], re.I), item["tytul"], item.get("typ"))
            for item in raw.get("przeformulowania", [])
        ],
        gaps=[Gap(re.compile(item["fraza"], re.I), item["tytul"], item.get("typ")) for item in raw.get("luki_w_tekscie", [])],
        follow_ups=[
            FollowUp(
                re.compile(item["wzorzec"], re.I),
                item["tytul"],
                re.compile(item["obetnij"], re.I) if item.get("obetnij") else None,
                item.get("podpowiedz"),
            )
            for item in raw.get("dopytania", [])
        ],
    )


def rewrite(title: str) -> tuple[str, str | None]:
    for rule in catalog().rewrites:
        if rule.pattern.search(title):
            return rule.title, rule.type
    return title, None
