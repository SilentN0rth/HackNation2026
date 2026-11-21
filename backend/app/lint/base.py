from dataclasses import dataclass


@dataclass
class Flag:
    id: str
    linter: str
    severity: str
    title: str
    message: str
    page_id: str | None = None
    field_id: str | None = None
    evidence: str | None = None
    suggestion: str | None = None

    def as_dict(self) -> dict:
        data = {
            "id": self.id,
            "linter": self.linter,
            "severity": self.severity,
            "title": self.title,
            "message": self.message,
        }
        for key, value in (
            ("pageId", self.page_id),
            ("fieldId", self.field_id),
            ("evidence", self.evidence),
            ("suggestion", self.suggestion),
        ):
            if value:
                data[key] = value
        return data
