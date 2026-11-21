"""Linter `coi-rules` – walidator reguł technicznych COI jako flagi (deterministyczny, bez LLM)."""

from app.coi.validator import validate_coi
from app.lint.base import FieldRef, LintContext, LintFlag, flag


def lint_coi_rules(ctx: LintContext) -> list[LintFlag]:
    by_tech = {f.tech: f for f in ctx.fields()}
    out: list[LintFlag] = []
    for issue in validate_coi(ctx.coi):
        ref: FieldRef | None = by_tech.get(issue.tech_name or "")
        f = flag("coi-rules", issue.severity, "Reguła techniczna COI", issue.message, ref, issue.rule)
        if ref is None and issue.tech_name:
            f.id = f"coi-rules:{issue.tech_name}:{issue.rule}"
        out.append(f)
    return out
