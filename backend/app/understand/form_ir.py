"""FormIR – model pośredni między rozumieniem dokumentu (heurystyki/LLM) a builderem COI.

Mały i płaski celowo: LLM zwraca dokładnie ten kształt (structured outputs), a UUID, siatkę,
JSONatę i flow zawsze robi kod (app/coi/builder.py).
"""

from dataclasses import dataclass, field

from app.coi.models import FieldType


@dataclass
class ConditionIR:
    """Pole pokazuje się, gdy pole `field_key` ma wartość `equals` (albo jej nie ma – `negate`)."""

    field_key: str
    equals: str
    negate: bool = False


@dataclass
class LegalBasisIR:
    act: str
    unit: str
    quote: str
    chunk_id: str | None = None


@dataclass
class FieldIR:
    key: str  # stabilny klucz lokalny (przed nadaniem techName)
    label: str
    type: FieldType = FieldType.TEXT_FIELD
    required: bool = True
    options: list[str] = field(default_factory=list)
    description: str = ""
    validators: list[str] = field(default_factory=list)
    dictionary: str | None = None
    condition: ConditionIR | None = None
    legal_basis: LegalBasisIR | None = None
    confidence: float = 1.0
    source: str = ""  # fragment dokumentu, z którego powstało pole
    needs_review: bool = False


@dataclass
class SectionIR:
    title: str
    fields: list[FieldIR] = field(default_factory=list)
    condition: ConditionIR | None = None


@dataclass
class PageIR:
    title: str
    sections: list[SectionIR] = field(default_factory=list)


@dataclass
class FormIR:
    title: str
    office: str | None = None
    pages: list[PageIR] = field(default_factory=list)
    legal_basis_text: list[str] = field(default_factory=list)
    standard_blocks: list[str] = field(default_factory=list)  # rozpoznane grupy zastąpione blokiem standardowym
    notes: list[str] = field(default_factory=list)
    ai_output_ref: str = "heuristics"

    def all_fields(self) -> list[FieldIR]:
        return [f for p in self.pages for s in p.sections for f in s.fields]
