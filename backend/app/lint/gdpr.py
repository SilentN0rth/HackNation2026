"""Linter `gdpr` – minimalizacja danych (reguły, bez LLM).

• dana wrażliwa / nadmiarowa bez podstawy prawnej → error,
• dana dostępna w rejestrze (MLPZ/PESEL), a pytana ręcznie w przedmiocie wniosku → sugestia prefill.
"""

import re

from app.lint.base import LintContext, LintFlag, flag, rules


def _contains(label: str, phrase: str) -> bool:
    return re.search(rf"(^|\W){re.escape(phrase)}(\W|$)", label.lower()) is not None


def lint_gdpr(ctx: LintContext) -> list[LintFlag]:
    cfg = rules()["gdpr"]
    out: list[LintFlag] = []
    for ref in ctx.subject_fields():
        label = ref.label
        has_basis = bool((ref.meta or {}).get("legalBasis"))
        hit = next((p for p in cfg["sensitive"] if _contains(label, p)), None)
        if hit and not has_basis:
            out.append(flag("gdpr", "error", "Dana nadmiarowa bez podstawy prawnej",
                            f"Pole „{label}” zbiera dane ({hit}), a nie ma wskazanego przepisu, który tego wymaga.",
                            ref, "sensitive",
                            suggestion="Usuń pole albo wskaż podstawę prawną (art. 5 ust. 1 lit. c RODO)."))
            continue
        reg = next((p for p in cfg["registry"] if _contains(label, p)), None)
        if reg and not ref.field.get("defaultValueType"):
            out.append(flag("gdpr", "info", "Dane dostępne w rejestrze",
                            f"Pole „{label}” można uzupełnić automatycznie z rejestru (MLPZ/PESEL) zamiast pytać.",
                            ref, "prefill", suggestion="Użyj danych inicjalnych (defaultValueType: EXTERNAL_SYSTEM)."))
    return out
