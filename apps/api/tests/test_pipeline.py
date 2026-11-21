import pytest

from app.coi.jsonata import references
from app.coi.validator import errors
from app.coi.walk import leaves
from app.pipeline import convert
from app.uploads import check_content
from tests.conftest import sample

FORMS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"]
FORMATS = [".pdf", ".docx", ".xlsx", ".ods", ".doc"]


def middle_fields(coi: dict) -> dict[str, dict]:
    return {item.field["techName"]: item.field for item in leaves(coi) if item.tab["title"] not in ("Dane", "Kontakt i zgody", "Strona końcowa")}


@pytest.mark.parametrize("extension", FORMATS)
@pytest.mark.parametrize("form", FORMS)
def test_every_sample_gives_valid_coi(form, extension):
    name, data = sample(form, extension)
    result = convert(check_content(name, data))
    assert errors(result.coi) == []
    assert result.coi["tabs"][0]["title"] == "Dane"
    assert result.coi["tabs"][-1]["type"] == "FINISH"
    assert len(result.coi["flow"]["links"]) == len(result.coi["tabs"]) - 1


def test_tax_refund_form_has_conditional_account_number():
    name, data = sample("2", ".pdf")
    result = convert(check_content(name, data))
    fields = middle_fields(result.coi)
    assert fields["data_uiszczenia_oplaty"]["type"] == "DATEPICKER"
    assert fields["wysokosc_oplaty"]["type"] == "NUMBER"
    account = fields["numer_rachunku"]
    refs = references(account["states"][0]["query"])
    assert refs and refs[0].value == "Przelewem na rachunek w banku"
    assert result.issuer == "Urząd Gminy Stawiguda"


def test_overpayment_form_matches_reference_structure():
    name, data = sample("5", ".pdf")
    result = convert(check_content(name, data))
    fields = middle_fields(result.coi)
    choice = fields["wybierz_co_mamy_zrobic_z_nadplata"]
    assert choice["type"] == "RADIO"
    assert {o["name"] for o in choice["options"]} == {
        "Zaliczyć na poczet przyszłego zobowiązania podatkowego",
        "Zwrócić przelewem na wskazany rachunek",
    }
    assert fields["nazwa_podatku"]["states"] and fields["numer_rachunku"]["states"]
    assert fields["uzasadnienie"]["type"] == "TEXTAREA"
    assert fields["korekta_deklaracji"]["type"] == "FILE_UPLOADER"


def test_address_form_finds_property_fields():
    name, data = sample("1", ".pdf")
    fields = middle_fields(convert(check_content(name, data)).coi)
    titles = {f["title"] for f in fields.values()}
    assert {"Miejscowość", "Ulica", "Numer ewidencyjny działki", "Obręb"} <= titles
