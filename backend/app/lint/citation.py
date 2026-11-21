"""Linter `citation-relevance` – czy cytat uzasadnia zbieranie pola (LLM, wynik cache'owany po hashu)."""

import hashlib

from app.lint.base import LintContext, LintFlag, flag
from app.understand.llm import citation_relevant

# (model, sha256(pole|cytat)) → (czy trafny, uzasadnienie, aiOutputRef)
_CACHE: dict[tuple[str, str], tuple[bool, str, str]] = {}


def lint_citation(ctx: LintContext) -> list[LintFlag]:
    if ctx.llm is None or not ctx.llm.enabled:
        return []
    out: list[LintFlag] = []
    for ref in ctx.subject_fields():
        lb = (ref.meta or {}).get("legalBasis")
        if not lb or not lb.get("quote"):
            continue
        key = (ctx.llm.settings.llm_model, hashlib.sha256(f"{ref.label}|{lb['quote']}".encode()).hexdigest())
        if key not in _CACHE:
            res = citation_relevant(ctx.llm, ref.label, lb["quote"])
            if res is None:
                continue
            _CACHE[key] = res
        relevant, reason, _ = _CACHE[key]
        if relevant:
            continue
        out.append(flag("citation-relevance", "warning", "Cytat nie uzasadnia pola",
                        f"Przepis wskazany dla pola „{ref.label}” dotyczy czegoś innego. {reason}", ref,
                        evidence=f"„{lb['quote'][:300]}”", suggestion="Wskaż inny przepis albo usuń pole."))
    return out
