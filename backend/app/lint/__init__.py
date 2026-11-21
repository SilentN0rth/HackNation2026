"""[6] Lintery. Trzy w pełni deterministyczne (coi-rules, static-graph, exact-match) – „AI napisało, kod sprawdził”."""

from app.legal.index import LegalIndex
from app.lint.base import LintContext, LintFlag
from app.lint.citation import lint_citation
from app.lint.coi_rules import lint_coi_rules
from app.lint.exact_match import lint_exact_match
from app.lint.gdpr import lint_gdpr
from app.lint.static_graph import lint_static_graph
from app.lint.wcag import lint_wcag
from app.understand.llm import LlmClient

LINTERS = (lint_coi_rules, lint_static_graph, lint_exact_match, lint_citation, lint_gdpr, lint_wcag)
_ORDER = {"error": 0, "warning": 1, "info": 2}


def run_linters(coi: dict, meta: dict, index: LegalIndex, llm: LlmClient | None = None,
                previous: list[LintFlag] | None = None) -> list[LintFlag]:
    """Uruchamia wszystkie lintery; przenosi rozstrzygnięcia urzędnika z poprzedniego przebiegu (po id flagi)."""
    ctx = LintContext(coi, meta, index, llm)
    flags: dict[str, LintFlag] = {}
    for linter in LINTERS:
        for f in linter(ctx):
            flags.setdefault(f.id, f)  # id unikalne; pierwszy wygrywa
    resolved = {f.id: f.resolution for f in previous or [] if f.resolution}
    for fid, res in resolved.items():
        if fid in flags:
            flags[fid].resolution = res
    return sorted(flags.values(), key=lambda f: (f.resolution is not None, _ORDER[f.severity], f.id))


def is_handled(f: LintFlag) -> bool:
    if f.resolution is None:
        return False
    return f.resolution.action == "fixed" or bool((f.resolution.justification or "").strip())


def can_publish(flags: list[LintFlag]) -> bool:
    return all(is_handled(f) for f in flags if f.severity == "error")


__all__ = ["LintFlag", "can_publish", "is_handled", "run_linters"]
