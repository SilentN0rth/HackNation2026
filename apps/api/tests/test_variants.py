"""Formularz łączący kilka wniosków: pytanie o rodzaj wniosku i strony widoczne tylko dla wybranego rodzaju."""

import pytest

from app.coi import builder
from app.coi.quality import quality
from app.coi.validator import errors
from app.extract.ir import Document
from app.mapping.frontend import to_frontend
from app.understand.heuristics import PREAMBLE, VARIANT, _split_variants, paginate, understand
from app.understand.model import Condition, FieldIR, SectionIR


def combined() -> Document:
    doc = Document(kind="docx")
    lines = [
        "Załącznik Nr 3 do zarządzenia",
        "Rodzaje wniosków:",
        "Wniosek o przyznanie stypendium sportowego Rady Miasta Testowo",
        "Wniosek o przyznanie nagrody sportowej Rady Miasta Testowo",
        "Wniosek o przyznanie wyróżnienia sportowego Rady Miasta Testowo",
    ]
    for text in lines:
        doc.add(text)
    for kind, extra in (("stypendium", "Klub kandydata"), ("nagrody", "Osiągnięcia kandydata"), ("wyróżnienia", "Dane trenera")):
        doc.add(f"Wniosek o przyznanie {kind} sportowego Rady Miasta Testowo", heading=True)
        doc.add(f"1. {extra}", heading=True)
        for i in range(12):
            doc.add(f"Pole numer {i} ………………………………")
    return doc


@pytest.fixture
def form():
    return understand(combined(), "wniosek.docx")


def test_variant_regex_accepts_roman_numeral_prefix():
    assert VARIANT.match("II. Wniosek o przyznanie nagrody sportowej Rady")
    assert not VARIANT.match("Wniosek o wydanie zaświadczenia")


def test_preamble_lines_are_not_fields():
    assert all(PREAMBLE.match(t) for t in ("Załącznik Nr 3 do zarządzenia", "Numer 245/IX/2024", "Rodzaje wniosków"))
    assert not PREAMBLE.match("Imię i nazwisko")


def test_index_and_blocks_are_separated(form):
    titles = [s.title for p in form.pages for s in p.sections]
    assert "Rodzaj wniosku" in titles
    assert any(t.startswith("Stypendium:") for t in titles) and any(t.startswith("Wyróżnienie:") for t in titles)


def test_form_title_names_all_variants(form):
    assert "stypendium, nagrody lub wyróżnienia" in form.title


def test_choice_offers_every_variant(form):
    choice = next(f for p in form.pages for s in p.sections for f in s.fields if f.title == "Rodzaj wniosku")
    assert choice.options == ["Stypendium sportowe", "Nagroda sportowa", "Wyróżnienie sportowe"]


def test_variant_sections_carry_a_condition_and_pages_do_not_mix(form):
    for page in form.pages:
        assert all(s.condition == page.sections[0].condition for s in page.sections)


def test_split_returns_none_for_plain_forms():
    doc = Document(kind="docx")
    for text in ("Wniosek o wydanie zaświadczenia", "1. Dane", "Imię ………"):
        doc.add(text)
    from app.understand.heuristics import prepare

    assert _split_variants(prepare(doc), set()) is None


def test_heavy_sections_are_split_into_parts():
    section = SectionIR("Dane", [FieldIR(f"k{i}", f"Pole {i}") for i in range(30)], Condition("x", "y"))
    pages = paginate([section])
    parts = [s for p in pages for s in p.sections]
    assert len(parts) == 3 and parts[0].title.endswith("(część 1 z 3)")
    assert all(len(s.fields) <= 14 and s.condition == section.condition for s in parts)


def test_built_form_is_valid_and_has_section_states(form):
    coi = builder.build(form)[0]
    assert errors(coi) == []
    conditional = [q["field"] for t in coi["tabs"] for q in t["questions"] if q["field"].get("states")]
    assert len(conditional) >= 3


def test_citizen_sees_only_chosen_variant_pages(form):
    coi, meta = builder.build(form)
    schema = to_frontend(coi, meta, schema_id="s", version=1, issuer="U", source_file="x.docx")
    choice = next(f for p in schema["pages"] for f in p["fields"] if f["label"] == "Rodzaj wniosku")

    def visible(answer):
        shown = []
        for page in schema["pages"]:
            cond = page.get("visibleIf")
            if cond is None or (answer == cond["equals"]) is not bool(cond.get("negate")):
                shown.append(page["title"])
        return shown

    stip = visible("Stypendium sportowe")
    assert any(t.startswith("Stypendium:") for t in stip) and not any(t.startswith(("Nagroda:", "Wyróżnienie:")) for t in stip)
    assert not any(t.startswith("Stypendium:") for t in visible("Nagroda sportowa"))
    assert choice["required"] is True


def test_generated_variant_form_has_no_heavy_or_long_warnings(form):
    coi = builder.build(form)[0]
    assert {i.code for i in quality(coi)} - {"junk-title", "organ-name"} == set()
