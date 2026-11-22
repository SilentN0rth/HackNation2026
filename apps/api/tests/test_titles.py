"""Tytuły, etykiety i nazwa organu: zapis zgodny ze standardami (bez kapitalików, bez białych znaków)."""

import pytest

from app.coi import builder
from app.coi.validator import validate
from app.coi.walk import iter_fields, leaves
from app.understand.model import FieldIR, FormIR, PageIR, SectionIR
from app.understand.text import normalize_title


def form(issuer: str | None = "Urząd Gminy Testowo", title: str = "Wniosek o coś", label: str = "Opis sprawy") -> FormIR:
    page = PageIR("Szczegóły", [SectionIR("Sprawa", [FieldIR("a", label, "TEXTAREA")])])
    return FormIR(title, issuer, [page])


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("WNIOSEK o wynajęcie/użyczenie świetlicy wiejskiej", "Wniosek o wynajęcie/użyczenie świetlicy wiejskiej"),
        ("DEKLARACJA O WYSOKOŚCI OPŁATY", "Deklaracja o wysokości opłaty"),
        ("Wniosek o zwrot opłaty skarbowej.", "Wniosek o zwrot opłaty skarbowej"),
        ("  Wniosek   o\nwydanie  zaświadczenia * ", "Wniosek o wydanie zaświadczenia"),
        ("ZGŁOSZENIE zmiany adresu", "Zgłoszenie zmiany adresu"),
    ],
)
def test_normalize_title(raw, expected):
    assert normalize_title(raw) == expected


def test_normalize_title_keeps_acronyms_that_are_not_title_words():
    assert normalize_title("PESEL w systemie") == "PESEL w systemie"


def test_normalize_title_is_idempotent():
    once = normalize_title("WNIOSEK o stwierdzenie nadpłaty podatku")
    assert normalize_title(once) == once


def test_field_title_whitespace_and_newlines_are_collapsed():
    coi = builder.build(form(label="\nWybierz,   co mamy\nzrobić z nadpłatą "))[0]
    titles = [i.field["title"] for i in leaves(coi)]
    assert "Wybierz, co mamy zrobić z nadpłatą" in titles
    assert all(t == " ".join(t.split()) for t in titles)


def test_option_names_are_collapsed():
    assert builder.option_list([" Zaliczyć  na\nposzczet ", "Nie"])[0]["name"] == "Zaliczyć na poszczet"


@pytest.mark.parametrize("issuer", ["Wójt Gminy Elbląg", "Prezydent Miasta Zgierza", "Burmistrz Miasta Testowo"])
def test_organ_addressed_forms_use_organ_labels(issuer):
    coi = builder.build(form(issuer))[0]
    section = coi["tabs"][0]["questions"][0]["field"]
    field = section["repeatingSectionGrid"][0]["field"]
    assert section["title"] == "Organ, do którego jest składany wniosek"
    assert (field["title"], field["techName"], field["defaultValue"]) == ("Nazwa organu", "nazwa_organu", issuer)


@pytest.mark.parametrize("issuer", ["Urząd Gminy Stawiguda", "Urząd Miejski Wrocławia", None])
def test_office_addressed_forms_keep_office_labels(issuer):
    coi = builder.build(form(issuer))[0]
    section = coi["tabs"][0]["questions"][0]["field"]
    assert section["title"] == "Urząd, do którego jest składany wniosek"
    assert section["repeatingSectionGrid"][0]["field"]["title"] == "Nazwa urzędu"


def test_organ_form_stays_valid_and_unique():
    coi = builder.build(form("Wójt Gminy Elbląg"))[0]
    assert [i for i in validate(coi) if i.severity == "error"] == []
    names = [i.field["techName"] for i in iter_fields(coi)]
    assert len(names) == len(set(names))
