from dataclasses import dataclass, field


@dataclass
class Line:
    text: str
    page: int = 1
    heading: bool = False
    cell: bool = False


@dataclass
class Document:
    kind: str
    lines: list[Line] = field(default_factory=list)
    pages: int = 1
    ocr_confidence: float | None = None
    warnings: list[str] = field(default_factory=list)

    def add(self, text: str | None, page: int = 1, heading: bool = False, cell: bool = False) -> None:
        if text is None:
            return
        for part in str(text).replace("\r", "\n").split("\n"):
            part = " ".join(part.split())
            if part:
                self.lines.append(Line(part, page, heading, cell))
