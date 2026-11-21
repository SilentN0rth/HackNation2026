"""Kontrakt linterów: LintFlag zgodny z frontend/src/types/lint.ts.

ID flagi jest deterministyczne – „<linter>:<techName>[:<reguła>]” – więc decyzja urzędnika
(poprawione / odrzucone z uzasadnieniem) przetrwa ponowne uruchomienie linterów.
"""

from dataclasses import dataclass, field
from functools import cache
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel

from app.legal.index import LegalIndex
from app.understand.llm import LlmClient

LinterId = Literal["coi-rules", "exact-match", "citation-relevance", "gdpr", "static-graph", "wcag"]
Severity = Literal["error", "warning", "info"]


class FlagResolution(BaseModel):
    action: Literal["fixed", "rejected"]
    justification: str | None = None
    by: str
    at: str


class LintFlag(BaseModel):
    id: str
    linter: LinterId
    severity: Severity
    pageId: str | None = None
    fieldId: str | None = None
    title: str
    message: str
    evidence: str | None = None
    suggestion: str | None = None
    resolution: FlagResolution | None = None


@dataclass
class FieldRef:
    """Pole COI razem z kontekstem (strona, sekcja) – wygodne dla linterów."""

    tab: dict[str, Any]
    section: dict[str, Any]
    field: dict[str, Any]
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def tech(self) -> str:
        return self.field.get("techName", "")

    @property
    def label(self) -> str:
        return self.field.get("title", "")


@dataclass
class LintContext:
    coi: dict[str, Any]
    meta: dict[str, dict[str, Any]]
    index: LegalIndex
    llm: LlmClient | None = None

    def fields(self) -> list[FieldRef]:
        out: list[FieldRef] = []
        for tab in self.coi.get("tabs", []):
            for q in tab.get("questions", []):
                sec = q["field"]
                for c in sec.get("repeatingSectionGrid") or []:
                    f = c["field"]
                    out.append(FieldRef(tab, sec, f, self.meta.get(f.get("techName", ""), {})))
        return out

    def subject_fields(self) -> list[FieldRef]:
        """Pola wygenerowane z dokumentu (mają meta) – bloki standardowe COI pomijamy."""
        return [f for f in self.fields() if f.tech in self.meta]


@cache
def rules() -> dict[str, Any]:
    return yaml.safe_load((Path(__file__).parent / "rules.yaml").read_text())


def flag(linter: LinterId, severity: Severity, title: str, message: str, ref: FieldRef | None = None,
         rule: str | None = None, **kw: Any) -> LintFlag:
    tech = ref.tech if ref else "form"
    fid = f"{linter}:{tech}" + (f":{rule}" if rule else "")
    return LintFlag(
        id=fid,
        linter=linter,
        severity=severity,
        pageId=ref.tab.get("id") if ref else None,
        fieldId=ref.tech if ref else None,
        title=title,
        message=message,
        **kw,
    )
