"""Zapytania JSONata dla `states` (SHOW / READ_ONLY) – generowanie i rozbiór.

Wzorzec z materiałów COI:
    ("Tak" in tabs['<tytuł strony>' in title].questions['<techName sekcji>' in field.techName]
       .field.repeatingSectionGrid['<techName pola>' in field.techName].field.__userAnswer)
Negacja: $not( … ).
"""

import re
from dataclasses import dataclass

_QUERY_RE = re.compile(
    r"\(\s*\"(?P<value>[^\"]*)\"\s+in\s+tabs\['(?P<tab>[^']*)'\s+in\s+title\]"
    r"\.questions\['(?P<section>[^']*)'\s+in\s+field\.techName\]"
    r"\.field\.repeatingSectionGrid\['(?P<field>[^']*)'\s+in\s+field\.techName\]"
    r"\.field\.__userAnswer\s*\)"
)


@dataclass(frozen=True)
class ShowRef:
    """Rozebrane odwołanie z warunku: na jakiej stronie / w jakiej sekcji / jakie pole / jaka wartość."""

    value: str
    tab_title: str
    section_tech: str
    field_tech: str
    negated: bool = False


def _q(s: str) -> str:
    return s.replace("'", "\\'")


def show_query(value: str, tab_title: str, section_tech: str, field_tech: str, negate: bool = False) -> str:
    value = value.replace('"', '\\"')
    q = (
        f"(\"{value}\" in tabs['{_q(tab_title)}' in title].questions['{_q(section_tech)}' in field.techName]"
        f".field.repeatingSectionGrid['{_q(field_tech)}' in field.techName].field.__userAnswer)"
    )
    return f"$not({q})" if negate else q


def parse_query(query: str) -> list[ShowRef]:
    """Wszystkie odwołania w zapytaniu (zapytanie może łączyć kilka warunków and/or)."""
    refs: list[ShowRef] = []
    for m in _QUERY_RE.finditer(query):
        prefix = query[: m.start()].rstrip()
        negated = prefix.endswith("$not(")
        refs.append(ShowRef(m["value"], m["tab"], m["section"], m["field"], negated))
    return refs
