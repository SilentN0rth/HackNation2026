"""Cały przebieg: upload → ekstrakcja → heurystyki (+LLM) → podstawa prawna → builder COI → lintery.

`on_step` dostaje etapy upload → parse → ocr → generate → lint → done (zgodnie z UPLOAD_STEP_LABELS na froncie).
"""

import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Literal

from app.coi.builder import BuildResult, build_coi
from app.config import Settings
from app.extract import DocumentIR, extract
from app.legal.index import LegalIndex, get_index
from app.lint import LintFlag, run_linters
from app.understand.form_ir import FormIR, LegalBasisIR
from app.understand.heuristics import understand
from app.understand.llm import LlmClient, refine_with_llm
from app.uploads import ValidatedUpload

Step = Literal["upload", "parse", "ocr", "generate", "lint", "done"]
BM25_MIN_SCORE = 4.0
_ACT_NAME = re.compile(r"(ustaw[ay]\s+z\s+dnia\s+.+?\s+(?:o|-)\s+[^,(;]+|kodeks[^,(;]*|ordynacj[ai]\s+podatkow\w+)",
                       re.I)


@dataclass
class ConvertResult:
    form: FormIR
    build: BuildResult
    flags: list[LintFlag]
    document: DocumentIR
    llm_used: bool = False
    steps: list[str] = field(default_factory=list)


def attach_legal_basis(form: FormIR, index: LegalIndex) -> None:
    """Podpowiedź „Dlaczego pytamy?”: BM25 na korpusie ustaw; cytat to dosłowne zdanie z aktu."""
    if index.empty:
        return
    acts = [m.group(1).strip() for t in form.legal_basis_text for m in _ACT_NAME.finditer(t)]
    for page in form.pages:
        for section in page.sections:
            for f in section.fields:
                if f.legal_basis:
                    continue
                hits = index.search(f"{f.label} {section.title}", k=1, acts=acts or None)
                if hits and hits[0].score >= BM25_MIN_SCORE:
                    h = hits[0]
                    f.legal_basis = LegalBasisIR(h.chunk.act, h.chunk.unit, h.quote, h.chunk.id)
                    f.needs_review = True  # podpowiedź automatyczna – urzędnik zatwierdza


def convert(upload: ValidatedUpload, settings: Settings, on_step: Callable[[Step], None] | None = None,
            llm: LlmClient | None = None, index: LegalIndex | None = None) -> ConvertResult:
    step = on_step or (lambda _s: None)
    steps: list[str] = []

    def mark(s: Step) -> None:
        steps.append(s)
        step(s)

    mark("upload")
    mark("parse")
    doc = extract(upload, settings)
    if doc.ocr_used:
        mark("ocr")
    mark("generate")
    form = understand(doc)
    llm = llm or LlmClient(settings)
    llm_used = False
    if llm.enabled:
        form = refine_with_llm(form, llm)
        llm_used = form.ai_output_ref != "heuristics"
    index = index or get_index()
    attach_legal_basis(form, index)
    build = build_coi(form, seed=upload.sha256)
    mark("lint")
    flags = run_linters(build.coi, build.meta, index, llm)
    for tech, m in build.meta.items():
        if m.get("needsReview") and m.get("confidence", 1) < 0.75:
            flags.append(LintFlag(id=f"wcag:{tech}:ocr", linter="wcag", severity="info", fieldId=tech,
                                  title="Pole wymaga przeglądu",
                                  message=f"Niska pewność OCR ({m['confidence']:.0%}) – sprawdź etykietę z oryginałem.",
                                  evidence=m.get("source")))
    mark("done")
    return ConvertResult(form, build, flags, doc, llm_used, steps)
