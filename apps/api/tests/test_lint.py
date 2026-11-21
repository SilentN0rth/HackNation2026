"""Testy jednostkowe linterów na małych, ręcznie zbudowanych konfiguracjach COI."""

from app import lint
from app.coi.jsonata import show_query
from app.dictionaries import load
from app.lint import dictionaries, gdpr, static_graph, wcag


def field(fid: str, title: str, type: str = "TEXT_FIELD", **extra) -> dict:
    return {"id": fid, "techName": fid, "title": title, "type": type, **extra}


def section(sid: str, *fields: dict, y: int = 0) -> dict:
    grid = [{"field": f, "y": i} for i, f in enumerate(fields)]
    return {"field": {"id": sid, "techName": sid, "title": sid, "type": "SECTION", "repeatingSectionGrid": grid}, "y": y}


def tab(tid: str, title: str, *sections: dict, type: str = "MAIN") -> dict:
    return {"id": tid, "title": title, "type": type, "questions": list(sections)}


def coi(*tabs: dict, links: list[tuple[str, str]] = ()) -> dict:
    return {"tabs": list(tabs), "flow": {"links": [{"source": s, "target": t} for s, t in links]}}


def ids(flags) -> set[str]:
    return {f.id for f in flags}


def form_with(*fields: dict, title: str = "Wniosek") -> dict:
    return coi(tab("t1", title, section("s1", *fields)))


# --- static-graph -----------------------------------------------------------


def test_unreachable_page():
    form = coi(tab("t1", "Start"), tab("t2", "Środek"), tab("t3", "Koniec", type="FINISH"), links=[("t1", "t3")])
    found = ids(static_graph.run(form))
    assert "static-graph:t2:unreachable" in found
    assert "static-graph:t3:unreachable" not in found
    assert "static-graph:flow:finish" not in found


def test_finish_not_reachable():
    form = coi(tab("t1", "Start"), tab("t2", "Koniec", type="FINISH"))
    assert "static-graph:flow:finish" in ids(static_graph.run(form))


def test_cycle_in_flow():
    form = coi(tab("t1", "Start"), tab("t2", "Koniec", type="FINISH"), links=[("t1", "t2"), ("t2", "t1")])
    assert "static-graph:flow:cycle" in ids(static_graph.run(form))


def condition_form(value: str, target_field: str = "zgoda", dependent_first: bool = False) -> dict:
    target = field("zgoda", "Czy masz zgodę?", "RADIO", options=[{"id": "Tak", "name": "Tak"}, {"id": "Nie", "name": "Nie"}])
    dependent = field("numer", "Numer zgody", states=[{"query": show_query(value, "Wniosek", "s1", target_field)}])
    order = (dependent, target) if dependent_first else (target, dependent)
    return form_with(*order)


def test_condition_on_valid_field_is_clean():
    flags = [f for f in static_graph.run(condition_form("Tak")) if f.field_id == "numer"]
    assert flags == []


def test_condition_on_missing_field():
    assert "static-graph:numer:brak:missing" in ids(static_graph.run(condition_form("Tak", target_field="brak")))


def test_condition_with_unknown_option():
    assert "static-graph:numer:zgoda:value" in ids(static_graph.run(condition_form("Może")))


def test_condition_on_later_field():
    assert "static-graph:numer:zgoda:order" in ids(static_graph.run(condition_form("Tak", dependent_first=True)))


# --- gdpr -------------------------------------------------------------------


def test_sensitive_field_without_legal_basis():
    flags = gdpr.run(form_with(field("f1", "Stan cywilny")))
    flag = next(f for f in flags if f.id == "gdpr:f1:sensitive")
    assert flag.severity == "warning"
    assert flag.field_id == "f1"


def test_sensitive_field_with_legal_basis():
    flags = gdpr.run(form_with(field("f1", "Stan cywilny")), {"f1": {"legalBasis": "art. 5 ust. 1"}})
    assert "gdpr:f1:sensitive" not in ids(flags)


def test_registry_data_outside_data_page():
    assert "gdpr:f1:registry" in ids(gdpr.run(form_with(field("f1", "PESEL"))))
    assert "gdpr:f1:registry" not in ids(gdpr.run(form_with(field("f1", "PESEL"), title="Dane")))
    assert "gdpr:f1:registry" not in ids(gdpr.run(form_with(field("f1", "PESEL", defaultValue="x"))))


def test_gdpr_ignores_non_input_fields():
    assert gdpr.run(form_with(field("f1", "Stan cywilny", "TEXT_BLOCK"))) == []


# --- wcag -------------------------------------------------------------------


def test_plain_label_is_clean():
    assert wcag.run(form_with(field("f1", "Twoje imię"))) == []


def test_empty_label_is_error():
    flags = wcag.run(form_with(field("f1", "  ")))
    assert [(f.id, f.severity) for f in flags] == [("wcag:f1:empty", "error")]


def test_long_question():
    assert "wcag:f1:long" in ids(wcag.run(form_with(field("f1", " ".join(["słowo"] * 21)))))


def test_upper_case_label():
    assert "wcag:f1:caps" in ids(wcag.run(form_with(field("f1", "ADRES ZAMIESZKANIA"))))


def test_bureaucratic_word():
    flags = wcag.run(form_with(field("f1", "Czy posiadać będziesz psa")))
    flag = next(f for f in flags if f.id == "wcag:f1:word:posiadać")
    assert "mieć" in flag.suggestion


def test_choice_field_size():
    few = [{"id": str(i), "name": str(i)} for i in range(3)]
    many = [{"id": str(i), "name": str(i)} for i in range(6)]
    assert "wcag:f1:select" in ids(wcag.run(form_with(field("f1", "Wybierz opcję", "SELECT", options=few))))
    assert "wcag:f1:radio" in ids(wcag.run(form_with(field("f1", "Wybierz opcję", "RADIO", options=many))))


def test_standard_pages_are_skipped():
    assert wcag.run(form_with(field("f1", ""), title="Dane")) == []


# --- dictionaries -----------------------------------------------------------


def test_dictionary_suggested_by_title():
    flags = dictionaries.run(form_with(field("f1", "Województwo")))
    assert [f.id for f in flags] == ["citation-relevance:f1:dictionary"]
    assert "Województwo" in flags[0].suggestion


def test_dictionary_suggested_by_options():
    values = load()["Województwo"]["wartosci"][:3]
    options = [{"id": v, "name": v} for v in values]
    assert "citation-relevance:f1:dictionary" in ids(dictionaries.run(form_with(field("f1", "Wybierz", "SELECT", options=options))))


def test_dictionary_already_attached():
    assert dictionaries.run(form_with(field("f1", "Województwo", "SELECT", dictionaryName="Województwo"))) == []


# --- agregacja --------------------------------------------------------------


def test_run_sorts_by_severity_and_removes_duplicates():
    form = form_with(field("f1", ""), field("f2", "Stan cywilny"), field("f3", "Województwo"))
    flags = lint.run(form)
    order = {"error": 0, "warning": 1, "info": 2}
    assert [order[f["severity"]] for f in flags] == sorted(order[f["severity"]] for f in flags)
    assert len({f["id"] for f in flags}) == len(flags)
    assert {"wcag:f1:empty", "gdpr:f2:sensitive", "citation-relevance:f3:dictionary"} <= {f["id"] for f in flags}
