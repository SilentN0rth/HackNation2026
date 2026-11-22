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


@pytest.mark.parametrize(("title", "junk"), [("Gdynia", True), ("Tak nie", True), ("Pesel", True), ("Dane", False), ("Dane sportowca", False), ("Adres nieruchomości", False)])
def test_junk_title_detection(title, junk):
    from app.understand.text import is_junk_title

    assert is_junk_title(title) is junk


def test_junk_page_title_is_replaced():
    from app.understand.heuristics import paginate

    pages = paginate([SectionIR("Gdynia", [FieldIR("a", "Pole")])])
    assert pages[0].title == "Szczegóły wniosku"


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("F. DANE DO KONTAKTU (pola nieobowiązkowe)", "Dane do kontaktu (pola nieobowiązkowe)"),
        ("B. DANE PODMIOTU ZOBOWIĄZANEGO DO ZŁOŻENIA DEKLARACJI", "Dane podmiotu zobowiązanego do złożenia deklaracji"),
        ("3. PESEL", "PESEL"),
        ("B.1 DANE IDENTYFIKACYJNE W PRZYPADKU NIP/REGON", "Dane identyfikacyjne w przypadku NIP/REGON"),
        ("Numer Pesel i NIP", "Numer PESEL i NIP"),
        ("Zaświadczenie z PZS", "Zaświadczenie z PZS"),
        ("ZAŁĄCZNIK A", "Załącznik A"),
    ],
)
def test_plain_heading_turns_caps_into_sentence_case_and_keeps_acronyms(raw, expected):
    from app.understand.text import plain_heading

    assert plain_heading(raw) == expected


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("Powierzchnia pasa drogowego potrzebna do zajęcia w celu realizacji w/w zakresu robót", "Powierzchnia pasa drogowego potrzebna do zajęcia"),
        ("Dane adresowe nieruchomości, na której powstają i są gromadzone odpady komunalne", "Dane adresowe nieruchomości"),
        ("Osoba odpowiedzialna (pełnoletnia) za utrzymanie porządku i bezpieczeństwa", "Osoba odpowiedzialna za utrzymanie porządku i bezpieczeństwa"),
        ("Dane do kontaktu", "Dane do kontaktu"),
    ],
)
def test_short_title_cuts_on_a_word_boundary_without_dangling_words(raw, expected):
    from app.understand.text import DANGLING, MAX_PAGE_TITLE, short_title

    title = short_title(raw)
    assert title == expected
    assert len(title) <= MAX_PAGE_TITLE and title.split()[-1].lower() not in DANGLING


def test_page_title_is_short_but_keeps_the_part_suffix():
    from app.understand.heuristics import paginate
    from app.understand.model import Condition

    long = "Powierzchnia pasa drogowego potrzebna do zajęcia w celu realizacji w/w zakresu robót"
    pages = paginate([SectionIR(long, [FieldIR(str(i), f"Pole {i}") for i in range(20)])])
    assert [p.title for p in pages] == [
        "Powierzchnia pasa drogowego potrzebna do zajęcia (część 1 z 2)",
        "Powierzchnia pasa drogowego potrzebna do zajęcia (część 2 z 2)",
    ]
    assert pages[0].sections[0].title == f"{long} (część 1 z 2)"
    a = "Oświadczenie o wysokości opłaty za gospodarowanie odpadami komunalnymi w zabudowie jednorodzinnej"
    b = "Oświadczenie o wysokości opłaty za gospodarowanie odpadami komunalnymi w zabudowie wielolokalowej"
    pages = paginate([SectionIR(a, [FieldIR("1", "x")], Condition("k", "1")), SectionIR(b, [FieldIR("2", "y")], Condition("k", "2"))])
    assert [p.title for p in pages] == ["Oświadczenie o wysokości opłaty", b]


def test_continued_section_split_into_parts_counts_the_section_it_continues():
    from app.understand.heuristics import paginate

    pages = paginate([SectionIR("Dane nieruchomości (ciąg dalszy)", [FieldIR(str(i), f"Pole {i}") for i in range(20)])])
    assert [p.title for p in pages] == ["Dane nieruchomości (część 2 z 3)", "Dane nieruchomości (część 3 z 3)"]
