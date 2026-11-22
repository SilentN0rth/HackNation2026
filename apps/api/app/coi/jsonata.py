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


TOKEN = re.compile(
    r"(?P<atom>" + ATOM.pattern + r")|(?P<not>\$not\()|(?P<open>\()|(?P<close>\))|(?P<and>\band\b)|(?P<or>\bor\b)|(?P<space>\s+)"
)


def _tokens(query: str) -> list[tuple[str, re.Match]] | None:
    result: list[tuple[str, re.Match]] = []
    pos = 0
    while pos < len(query):
        match = TOKEN.match(query, pos)
        if not match:
            return None
        kind = match.lastgroup
        if kind == "atom":
            result.append(("atom", match))
        elif kind != "space":
            result.append((kind, match))
        pos = match.end()
    return result


def parse_expr(query: str):
    """Rozbiera zapytanie SHOW z `and`, `or`, nawiasami i `$not(...)` na drzewo.

    Węzły: ("atom", Reference), ("not", node), ("and", [node, ...]), ("or", [node, ...]).
    Zwraca None, gdy zapytanie ma inną składnię niż odwołania do odpowiedzi.
    """
    tokens = _tokens(query)
    if not tokens:
        return None
    pos = 0

    def peek() -> str | None:
        return tokens[pos][0] if pos < len(tokens) else None

    def take() -> tuple[str, re.Match]:
        nonlocal pos
        pos += 1
        return tokens[pos - 1]

    def parse_or():
        nodes = [parse_and()]
        while peek() == "or":
            take()
            nodes.append(parse_and())
        return nodes[0] if len(nodes) == 1 else ("or", nodes)

    def parse_and():
        nodes = [parse_unary()]
        while peek() == "and":
            take()
            nodes.append(parse_unary())
        return nodes[0] if len(nodes) == 1 else ("and", nodes)

    def parse_unary():
        kind = peek()
        if kind == "atom":
            m = take()[1]
            value = m.group("value").replace('\\"', '"').replace("\\\\", "\\")
            return ("atom", Reference(value, m.group("tab"), m.group("section"), m.group("field")))
        if kind in ("open", "not"):
            take()
            inner = parse_or()
            if peek() != "close":
                raise ValueError("brak nawiasu zamykającego")
            take()
            return ("not", inner) if kind == "not" else inner
        raise ValueError("nieoczekiwany token")

    try:
        tree = parse_or()
    except ValueError:
        return None
    return tree if pos == len(tokens) else None
