"""Struktura złożonych wniosków: listy numerowane, zgody z numeracją „1)”, załączniki i podział długich sekcji."""

from app.extract.ir import Document
from app.understand.heuristics import _cut_near, understand
from app.understand.model import FieldIR, FormIR


def run(*lines: str) -> FormIR:
    doc = Document(kind="docx")
    for text in lines:
        doc.add(text)
    return understand(doc, "wniosek.docx")


def fields(form: FormIR) -> list[FieldIR]:
    return [f for page in form.pages for s in page.sections for f in s.fields]


def titles(form: FormIR) -> list[str]:
    return [f.title for f in fields(form)]


def test_issuer_line_inside_first_variant_block_stays_a_field():
    lines = ["Załącznik Nr 3 do zarządzenia", "Rodzaje wniosków:"]
    kinds = ("stypendium", "nagrody", "wyróżnienia")
    lines += [f"Wniosek o przyznanie {k} sportowego Rady Miasta Testowo" for k in kinds]
    for kind in kinds:
        lines += [f"Wniosek o przyznanie {kind} sportowego Rady Miasta Testowo", "1. Wnioskodawca", "Prezydent Miasta Testowo", "Klub sportowy"]
        lines += [f"Pole numer {i}" for i in range(8)]
    form = run(*lines)
    assert titles(form).count("Prezydent Miasta Testowo") == 3


def test_numbered_list_items_do_not_open_a_new_section():
    lines = ["1. Wnioskodawca", "Imię", "2. Dane trenera", "Nazwisko", "3. Dane podopiecznych trenera"]
    for n in range(1, 5):
        lines += [f"{n}. Dane osobowe podopiecznego trenera", "Imię i nazwisko zawodniczki/zawodnika", "Osiągnięcia sportowe podopiecznego"]
    lines += ["Wymagane zaświadczenia wymienionych podopiecznych trenera", "Do wniosku należy załączyć zaświadczenia wydane przez Polski Związek Sportowy."]
    form = run(*lines)
    assert titles(form).count("Imię i nazwisko zawodniczki/zawodnika") == 4
    uploads = [f for f in fields(form) if f.type == "FILE_UPLOADER"]
    assert [(u.title, u.required) for u in uploads] == [("Wymagane zaświadczenia wymienionych podopiecznych trenera", True)]


def test_consents_numbered_with_parenthesis_are_kept_and_container_is_not_a_field():
    form = run(
        "1. Dane osobowe",
        "Imię",
        "2. Zgody",
        "2.1. Zgoda kandydata pełnoletniego",
        "Imię i nazwisko kandydata",
        "1) Wyrażam zgodę na przetwarzanie moich danych osobowych zawartych we wniosku w celu dalszego procedowania.",
        "2) Oświadczam, że zapoznałem się z regulaminem i akceptuję wszystkie jego postanowienia.",
    )
    consent = [f for f in fields(form) if f.type == "CONSENT_SECTION"]
    assert len(consent) == 1 and len(consent[0].options) == 2
    assert "Zgody" not in titles(form)


def test_attachment_sentence_becomes_upload_field():
    form = run(
        "1. Osiągnięcia",
        "Opinia macierzystego klubu sportowego, potwierdzająca nienaganną postawę etyczną i moralną sportowca",
        "Do wniosku można dołączyć dokument z opinią klubu.",
    )
    kinds = [(f.type, f.required) for f in fields(form)]
    assert ("TEXT_FIELD", True) in kinds and ("FILE_UPLOADER", False) in kinds
    assert "Dokument z opinią klubu" in titles(form)


def test_long_section_is_cut_before_a_group_not_inside_it():
    names = [f"Pole {i}" for i in range(20)]
    names[2], names[11] = "Dane reprezentanta", "Dane klubu"
    items = [FieldIR(key=str(i), title=name) for i, name in enumerate(names)]
    assert _cut_near(items, 10) == 11
    assert _cut_near([FieldIR(key=str(i), title=f"Pole {i}") for i in range(20)], 10) == 10


def test_options_opening_a_section_become_a_radio_and_the_cue_makes_following_fields_conditional():
    form = run(
        "1. Wnioskodawca",
        "□ Osoba fizyczna",
        "□ Klub sportowy",
        "Należy wypełnić w przypadku Wnioskodawcy – Klubu sportowego.",
        "Nazwa klubu sportowego",
        "Adres siedziby",
    )
    found = fields(form)
    radio = next(f for f in found if f.type == "RADIO")
    assert radio.title == "Wnioskodawca" and radio.options == ["Osoba fizyczna", "Klub sportowy"]
    club = [f for f in found if f.title in ("Nazwa klubu sportowego", "Adres siedziby")]
    assert club and all(f.condition and f.condition.equals == "Klub sportowy" for f in club)


def test_group_heading_is_a_text_block_not_an_input():
    form = run("1. Wnioskodawca", "Dane pełnomocnika klubu sportowego", "Imię", "Nazwisko")
    heading = next(f for f in fields(form) if f.title.startswith("Dane pełnomocnika"))
    assert heading.type == "TEXT_BLOCK" and not heading.required


def test_text_block_heading_reaches_the_web_model_and_survives_a_round_trip():
    from app.coi import builder
    from app.mapping.frontend import from_frontend, to_frontend

    form = run("1. Wnioskodawca", "Dane pełnomocnika klubu sportowego", "Imię", "Nazwisko")
    coi, meta = builder.build(form, "Urząd")
    schema = to_frontend(coi, meta, schema_id="t", version=1, issuer="Urząd", source_file="w.pdf")
    info = [f for p in schema["pages"] for f in p["fields"] if f["type"] == "info"]
    assert [f["label"] for f in info] == ["Dane pełnomocnika klubu sportowego"] and not info[0]["required"]
    back, _ = from_frontend(coi, meta, schema)
    assert any(i.field["type"] == "TEXT_BLOCK" for i in __import__("app.coi.walk", fromlist=["leaves"]).leaves(back))


def test_other_option_is_free_text_and_dictionary_heading_is_not_duplicated():
    form = run("1. Dane sportowca", "Dyscypliny sportowe", "Dyscypliny sportowe:", "Inna dyscyplina")
    found = [(f.title, f.type, f.dictionary) for f in fields(form)]
    assert [t for t, *_ in found].count("Dyscypliny sportowe") == 1
    assert ("Inna dyscyplina", "TEXT_FIELD", None) in found


def test_wrapped_variant_heading_leaves_no_stray_field():
    lines = ["Rodzaje wniosków:"]
    kinds = ("stypendium", "nagrody", "wyróżnienia")
    lines += [f"Wniosek o przyznanie {k} sportowego Rady Miasta Zgierza" for k in kinds]
    for kind in kinds:
        lines += [f"Wniosek o przyznanie {kind} sportowego Rady Miasta", "Zgierza", "1. Wnioskodawca"]
        lines += [f"Pole numer {i}" for i in range(8)]
    assert "Zgierza" not in titles(run(*lines))


def test_listed_disciplines_bind_to_the_proposed_dictionary_instead_of_hardcoded_options():
    form = run(
        "1. Dane sportowca",
        "Rodzaj dyscypliny",
        "□ Zespołowa",
        "□ Indywidualna",
        "Dyscypliny sportowe",
        "□ Piłka nożna",
        "□ Koszykówka",
        "□ Unihokej",
        "□ Hokej",
        "□ Szachy",
        "□ Sporty walki",
        "Inna dyscyplina",
    )
    found = {f.title: f for f in fields(form)}
    disciplines = found["Dyscypliny sportowe"]
    assert (disciplines.type, disciplines.dictionary, disciplines.options) == ("SELECT", "DYSCYPLINY_SPORTOWE", [])
    kind = found["Rodzaj dyscypliny"]
    assert kind.dictionary is None and kind.options == ["Zespołowa", "Indywidualna"]
    assert found["Inna dyscyplina"].dictionary is None


def test_bound_dictionary_field_is_valid_coi():
    from app.coi import builder
    from app.coi.validator import errors

    form = run("1. Dane sportowca", "Dyscypliny sportowe", "□ Piłka nożna", "□ Koszykówka", "□ Judo")
    coi, _ = builder.build(form, "Urząd")
    leaves = __import__("app.coi.walk", fromlist=["leaves"]).leaves
    field = next(i.field for i in leaves(coi) if i.field.get("dictionaryName") == "DYSCYPLINY_SPORTOWE")
    assert field["type"] == "SELECT" and field["options"] == []
    assert errors(coi) == []


def test_dictionary_is_not_bound_when_listed_options_are_not_its_values():
    from app.dictionaries import covers

    assert covers("DYSCYPLINY_SPORTOWE", ["Piłka nożna", "Hokej", "Narciarstwo klasyczne"])
    assert not covers("DYSCYPLINY_SPORTOWE", ["Zespołowa", "Indywidualna – inna", "Indywidualna – lekkoatletyka"])
    assert not covers("DYSCYPLINY_SPORTOWE", ["Piłka nożna"])
    form = run("1. Dane sportowca", "Dyscypliny sportowe", "□ Zespołowa", "□ Indywidualna")
    assert all(f.dictionary is None for f in fields(form))

