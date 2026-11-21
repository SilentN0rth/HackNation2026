"""Linter `exact-match` – czy cytat podstawy prawnej istnieje w tekście ustawy (kod, bez LLM).

Normalizacja (spacje, myślniki, cudzysłowy, przenoszenie wyrazów) + rapidfuzz:
  ≥ 95 → zgodny, 80–95 → ostrzeżenie (OCR/literówka), < 80 → halucynacja (error).
Jednostka redakcyjna (art./ust./pkt) pochodzi z parsera ustawy – sprawdzamy, czy pasuje do fragmentu.
"""

from app.lint.base import LintContext, LintFlag, flag

OK, WARN = 95.0, 80.0


def lint_exact_match(ctx: LintContext) -> list[LintFlag]:
    out: list[LintFlag] = []
    for ref in ctx.subject_fields():
        lb = (ref.meta or {}).get("legalBasis")
        if not lb or not lb.get("quote"):
            if not ctx.index.empty and ref.field.get("type") not in {"TEXT_BLOCK", "INFO_SECTION"}:
                out.append(flag("exact-match", "info", "Brak podstawy prawnej",
                                f"Pole „{ref.label}” nie ma wskazanego przepisu – „Dlaczego pytamy?” będzie puste.",
                                ref, suggestion="Wskaż przepis albo rozważ usunięcie pola (minimalizacja danych)."))
            continue
        if ctx.index.empty:
            out.append(flag("exact-match", "info", "Brak korpusu ustaw",
                            "Nie można sprawdzić cytatu – w data/statutes nie ma tekstów ustaw.", ref))
            continue
        score, chunk = ctx.index.find_quote(lb["quote"])
        if score >= OK:
            if chunk and lb.get("unit") and chunk.unit.replace(" ", "") != str(lb["unit"]).replace(" ", ""):
                out.append(flag("exact-match", "warning", "Inna jednostka redakcyjna",
                                f"Cytat pochodzi z {chunk.unit}, a pole wskazuje {lb['unit']}.", ref, "unit",
                                evidence=chunk.text[:400], suggestion=f"Zmień jednostkę na „{chunk.unit}”."))
            continue
        sev = "warning" if score >= WARN else "error"
        title = "Cytat różni się od ustawy" if sev == "warning" else "Cytatu nie ma w ustawie"
        msg = (f"Cytat dla pola „{ref.label}” jest podobny do tekstu {chunk.unit} ({score:.0f}%), ale nie identyczny."
               if sev == "warning" and chunk else
               f"Cytat dla pola „{ref.label}” nie występuje w żadnej ustawie z korpusu (podobieństwo {score:.0f}%). "
               "To może być halucynacja modelu.")
        out.append(flag("exact-match", sev, title, msg, ref, evidence=f"„{lb['quote'][:300]}”",
                        suggestion=f"Najbliższy fragment ({chunk.unit}): {chunk.text[:300]}" if chunk else None))
    return out
