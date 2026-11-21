"""Modele formatu JSON COI (Pydantic v2).

`extra="allow"` – nie gubimy kluczy, których nie znamy (bezstratny round-trip).
Nazwy kluczy jak we wzorcach COI (camelCase), w tym `repeatingSectionGrid`
(schemat ma literówkę `repetingSectionGrid`, wzorce – poprawną nazwę; emitujemy jak we wzorcach).
"""

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class FieldType(StrEnum):
    TEXT_FIELD = "TEXT_FIELD"
    TEXTAREA = "TEXTAREA"
    NUMBER = "NUMBER"
    DATEPICKER = "DATEPICKER"
    SELECT = "SELECT"
    RADIO = "RADIO"
    CHECKBOX = "CHECKBOX"
    FILE_UPLOADER = "FILE_UPLOADER"
    TEXT_BLOCK = "TEXT_BLOCK"
    INFO_SECTION = "INFO_SECTION"
    CONSENT_SECTION = "CONSENT_SECTION"
    SECTION = "SECTION"
    REPEATING_SECTION = "REPEATING_SECTION"


SECTION_TYPES = {FieldType.SECTION, FieldType.REPEATING_SECTION}
INPUT_TYPES = {
    FieldType.TEXT_FIELD,
    FieldType.TEXTAREA,
    FieldType.NUMBER,
    FieldType.DATEPICKER,
    FieldType.SELECT,
    FieldType.RADIO,
    FieldType.CHECKBOX,
    FieldType.FILE_UPLOADER,
    FieldType.CONSENT_SECTION,
}
DICTIONARY_TYPES = {FieldType.SELECT, FieldType.RADIO, FieldType.CHECKBOX}
VALIDATORS = {"REQUIRED", "EMAIL", "PESEL", "NIP", "REGON", "ZIP_CODE", "EPUAP", "ADE", "SERIAL_NUMBER_ID_CARD"}


class TabType(StrEnum):
    MAIN = "MAIN"
    FINISH = "FINISH"


class CoiModel(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True, use_enum_values=True)


class Option(CoiModel):
    id: str
    name: str
    techName: str | None = None


class State(CoiModel):
    type: str  # SHOW | READ_ONLY
    query: str


class Field_(CoiModel):
    id: str
    type: FieldType
    techName: str = ""
    title: str = ""
    description: str = ""
    options: list[Option] = Field(default_factory=list)
    # we wzorcach bywa [] albo {} – przyjmujemy oba, emitujemy listę
    validation: list[str] | dict[str, Any] = Field(default_factory=list)
    readOnly: bool = False
    repeatingSectionGrid: list[Question] = Field(default_factory=list)
    states: list[State] = Field(default_factory=list)
    questionOrder: int = 0
    tooltipMessage: str = ""
    defaultValue: Any = None
    defaultValueType: str | None = None
    dictionaryName: str | None = None

    @property
    def validators(self) -> list[str]:
        return list(self.validation) if isinstance(self.validation, list) else []


class Question(CoiModel):
    x: int = 0
    y: int = 0
    rows: int = 1
    cols: int = 3
    field: Field_


class Tab(CoiModel):
    id: str
    title: str
    type: TabType
    questions: list[Question] = Field(default_factory=list)


class Link(CoiModel):
    id: str
    source: str
    target: str


class Flow(CoiModel):
    links: list[Link] = Field(default_factory=list)


class CoiForm(CoiModel):
    title: str
    tabs: list[Tab]
    flow: Flow = Field(default_factory=Flow)

    def dump(self) -> dict[str, Any]:
        """JSON COI do eksportu: bez None, z kluczami jak we wzorcach."""
        return self.model_dump(mode="json", exclude_none=True)


Field_.model_rebuild()
