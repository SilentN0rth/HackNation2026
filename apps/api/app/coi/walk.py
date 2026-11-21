from collections.abc import Iterator
from dataclasses import dataclass

INPUT_TYPES = {"TEXT_FIELD", "TEXTAREA", "NUMBER", "DATEPICKER", "SELECT", "RADIO", "CHECKBOX", "FILE_UPLOADER"}
CHOICE_TYPES = {"SELECT", "RADIO", "CHECKBOX"}
SECTION_TYPES = {"SECTION", "REPEATING_SECTION"}
FIELD_TYPES = INPUT_TYPES | SECTION_TYPES | {"TEXT_BLOCK", "INFO_SECTION", "CONSENT_SECTION"}
VALIDATORS = {"REQUIRED", "EMAIL", "PESEL", "NIP", "REGON", "ZIP_CODE", "EPUAP", "ADE", "SERIAL_NUMBER_ID_CARD"}


@dataclass
class Located:
    tab: dict
    section: dict | None
    cell: dict

    @property
    def field(self) -> dict:
        return self.cell["field"]


def children(field: dict) -> list[dict]:
    return field.get("repeatingSectionGrid") or field.get("repetingSectionGrid") or []


def iter_fields(coi: dict) -> Iterator[Located]:
    for tab in coi.get("tabs", []):
        for cell in tab.get("questions", []):
            yield Located(tab, None, cell)
            for child in children(cell.get("field", {})):
                yield Located(tab, cell["field"], child)


def leaves(coi: dict) -> Iterator[Located]:
    for item in iter_fields(coi):
        if item.section is not None:
            yield item
