from dataclasses import dataclass, field


@dataclass
class Condition:
    field_key: str
    equals: str


@dataclass
class FieldIR:
    key: str
    title: str
    type: str = "TEXT_FIELD"
    required: bool = True
    validation: list[str] = field(default_factory=list)
    options: list[str] = field(default_factory=list)
    dictionary: str | None = None
    tooltip: str = ""
    description: str = ""
    condition: Condition | None = None
    source: str = ""
    page: int = 1


@dataclass
class SectionIR:
    title: str
    fields: list[FieldIR] = field(default_factory=list)


@dataclass
class PageIR:
    title: str
    sections: list[SectionIR] = field(default_factory=list)


@dataclass
class FormIR:
    title: str
    issuer: str | None
    pages: list[PageIR] = field(default_factory=list)
    legal_basis: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    ocr_confidence: float | None = None
