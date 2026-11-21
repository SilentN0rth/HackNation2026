import re
from dataclasses import dataclass

SHOW = re.compile(
    r"""^\(?\s*(?P<neg>\$not\()?\s*\(?\s*"(?P<value>(?:[^"\\]|\\.)*)"\s+in\s+"""
    r"""tabs\['(?P<tab>[^']*)'\s+in\s+title\]\.questions\['(?P<section>[^']*)'\s+in\s+field\.techName\]"""
    r"""\.field\.repeatingSectionGrid\['(?P<field>[^']*)'\s+in\s+field\.techName\]\.field\.__userAnswer\s*\)?\s*\)?\s*\)?$"""
)


ATOM = re.compile(
    r""""(?P<value>(?:[^"\\]|\\.)*)"\s+in\s+tabs\['(?P<tab>[^']*)'\s+in\s+title\]\.questions\['(?P<section>[^']*)'\s+in\s+field\.techName\]"""
    r"""\.field\.repeatingSectionGrid\['(?P<field>[^']*)'\s+in\s+field\.techName\]\.field\.__userAnswer"""
)


@dataclass(frozen=True)
class Reference:
    value: str
    tab: str
    section: str
    field: str
    negated: bool = False


def _quote(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"')


def _escape_name(value: str) -> str:
    return value.replace("'", "’")


def show_query(value: str, tab: str, section: str, field: str, negated: bool = False) -> str:
    core = (
        f'("{_quote(value)}" in tabs[\'{_escape_name(tab)}\' in title].questions[\'{section}\' in field.techName]'
        f".field.repeatingSectionGrid['{field}' in field.techName].field.__userAnswer)"
    )
    return f"$not({core})" if negated else core


def parse(query: str) -> Reference | None:
    match = SHOW.match(query.strip())
    if not match:
        return None
    value = match.group("value").replace('\\"', '"').replace("\\\\", "\\")
    return Reference(value, match.group("tab"), match.group("section"), match.group("field"), bool(match.group("neg")))


def references(query: str) -> list[Reference]:
    return [
        Reference(m.group("value").replace('\\"', '"'), m.group("tab"), m.group("section"), m.group("field"))
        for m in ATOM.finditer(query)
    ]
