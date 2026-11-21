"""Lintery: static-graph, exact-match, gdpr, wcag + przenoszenie rozstrzygnięć i blokada publikacji."""

import copy
import json

import pytest

from app.coi.builder import build_coi
from app.coi.models import FieldType
from app.legal.index import LegalIndex
from app.legal.parser import parse_statute
from app.lint import can_publish, run_linters
from app.lint.base import FlagResolution
from app.understand.form_ir import ConditionIR, FieldIR, FormIR, LegalBasisIR, PageIR, SectionIR
from tests.conftest import FIXTURES, REFERENCE


@pytest.fixture
def index() -> LegalIndex:
    return LegalIndex(parse_statute((FIXTURES / "ustawa_testowa.txt").read_text(), "test"))


@pytest.fixture
def wzorzec() -> dict:
    return json.loads((REFERENCE / "wzorzec_5_nadplata_podatku.json").read_text())


def make_form(*fields: FieldIR) -> FormIR:
    return FormIR("Wniosek o zwrot opłaty", "Urząd Gminy Test", [PageIR("Zwrot", [SectionIR("Zwrot", list(fields))])])


def ids(flags) -> set[str]:
    return {f.id for f in flags}


def test_static_graph_condition_to_renamed_page_returns_error(wzorzec, index):
    broken = copy.deepcopy(wzorzec)
    broken["tabs"][0]["title"] = "Dane osobowe"  # warunki dalej wskazują „Dane”

    flags = run_linters(broken, {}, index)

    graph = [f for f in flags if f.linter == "static-graph" and f.severity == "error"]
    assert graph and all("nieistniejącą stronę" in f.title for f in graph)


def test_static_graph_condition_with_unknown_option_returns_error(index):
    choice = FieldIR("f1", "Sposób zwrotu", FieldType.RADIO, options=["Gotówką", "Przelewem"])
    account = FieldIR("f2", "Numer rachunku", condition=ConditionIR("f1", "Czekiem"))
    coi = build_coi(make_form(choice, account)).coi

    flags = run_linters(coi, {}, index)

    assert any(f.title == "Warunek z nieistniejącą odpowiedzią" for f in flags)


def test_static_graph_valid_condition_returns_no_graph_flags(index):
    choice = FieldIR("f1", "Sposób zwrotu", FieldType.RADIO, options=["Gotówką", "Przelewem"])
    account = FieldIR("f2", "Numer rachunku", condition=ConditionIR("f1", "Przelewem"))
    build = build_coi(make_form(choice, account))

    flags = run_linters(build.coi, build.meta, index)

    assert [f for f in flags if f.linter == "static-graph"] == []


def test_exact_match_quote_from_statute_passes(index):
    quote = "Do wniosku dołącza się dowód uiszczenia opłaty."
    f = FieldIR("f1", "Dowód uiszczenia opłaty", FieldType.FILE_UPLOADER,
                legal_basis=LegalBasisIR("Ustawa testowa", "art. 1 ust. 2", quote))
    build = build_coi(make_form(f))

    flags = run_linters(build.coi, build.meta, index)

    assert not [x for x in flags if x.linter == "exact-match"]


def test_exact_match_hallucinated_quote_returns_error(index):
    f = FieldIR("f1", "Liczba pokoi", FieldType.NUMBER,
                legal_basis=LegalBasisIR("Ustawa testowa", "art. 9", "Wnioskodawca podaje liczbę pokoi w lokalu."))
    build = build_coi(make_form(f))

    flags = run_linters(build.coi, build.meta, index)

    (flag,) = [x for x in flags if x.linter == "exact-match"]
    assert flag.severity == "error"
    assert flag.id == f"exact-match:{flag.fieldId}"


def test_exact_match_quote_with_typo_returns_warning(index):
    quote = "Do wniosku dolacza sie dowod uiszczenia oplaty skarbowej."  # OCR zgubił polskie znaki
    f = FieldIR("f1", "Dowód", FieldType.FILE_UPLOADER, legal_basis=LegalBasisIR("Ustawa testowa", "art. 1 ust. 2",
                                                                                 quote))
    build = build_coi(make_form(f))

    (flag,) = [x for x in run_linters(build.coi, build.meta, index) if x.linter == "exact-match"]

    assert flag.severity == "warning"


def test_gdpr_id_card_number_without_basis_returns_error(index):
    build = build_coi(make_form(FieldIR("f1", "Numer dowodu osobistego")))

    flags = run_linters(build.coi, build.meta, index)

    assert any(f.linter == "gdpr" and f.severity == "error" for f in flags)


def test_wcag_compound_question_and_forbidden_phrase_are_flagged(index):
    build = build_coi(make_form(FieldIR("f1", "Czy posiadasz psa i kota?")))

    flags = run_linters(build.coi, build.meta, index)

    titles = {f.title for f in flags if f.linter == "wcag"}
    assert {"Pytanie wielokrotnie złożone", "Urzędniczy zwrot"} <= titles


def test_wcag_select_with_three_options_suggests_radio(index):
    build = build_coi(make_form(FieldIR("f1", "Rodzaj", FieldType.SELECT, options=["A", "B", "C"])))

    flags = run_linters(build.coi, build.meta, index)

    assert any(f.id.endswith(":select-few") for f in flags)


def test_run_linters_keeps_resolution_from_previous_run(index):
    build = build_coi(make_form(FieldIR("f1", "Numer dowodu osobistego")))
    first = run_linters(build.coi, build.meta, index)
    err = next(f for f in first if f.severity == "error")
    err.resolution = FlagResolution(action="rejected", justification="Wymaga tego regulamin gminy.", by="AN",
                                    at="2026-11-21")

    second = run_linters(build.coi, build.meta, index, previous=first)

    assert next(f for f in second if f.id == err.id).resolution is not None


def test_can_publish_requires_justification_for_rejected_error(index):
    build = build_coi(make_form(FieldIR("f1", "Numer dowodu osobistego")))
    flags = run_linters(build.coi, build.meta, index)
    err = next(f for f in flags if f.severity == "error")
    assert not can_publish(flags)

    err.resolution = FlagResolution(action="rejected", justification="  ", by="AN", at="x")
    assert not can_publish(flags)

    err.resolution = FlagResolution(action="rejected", justification="Wymaga tego przepis lokalny.", by="AN", at="x")
    assert can_publish(flags)
