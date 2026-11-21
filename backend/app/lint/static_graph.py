import networkx as nx

from app.coi.jsonata import references
from app.coi.validator import validate
from app.coi.walk import iter_fields, leaves
from app.lint.base import Flag

LINTER = "static-graph"


def run(coi: dict) -> list[Flag]:
    flags: list[Flag] = []
    for issue in validate(coi):
        key = f"{LINTER}:{issue.tech_name or issue.tab or 'form'}:{issue.code}"
        flags.append(
            Flag(key, LINTER, issue.severity, "Niezgodność z regułami COI", issue.message, issue.tab_id, issue.field_id)
        )

    tabs = coi.get("tabs") or []
    graph = nx.DiGraph()
    graph.add_nodes_from(t.get("id") for t in tabs)
    for link in (coi.get("flow") or {}).get("links") or []:
        graph.add_edge(link.get("source"), link.get("target"))
    if tabs:
        start = tabs[0].get("id")
        finish = [t.get("id") for t in tabs if t.get("type") == "FINISH"]
        reachable = nx.descendants(graph, start) | {start} if start in graph else set()
        for tab in tabs[1:]:
            if tab.get("id") not in reachable:
                flags.append(
                    Flag(
                        f"{LINTER}:{tab.get('id')}:unreachable",
                        LINTER,
                        "error",
                        "Strona jest nieosiągalna",
                        f"Do strony „{tab.get('title')}” nie prowadzi żadne przejście z pierwszej strony.",
                        tab.get("id"),
                        suggestion="Dodaj przejście w sekcji flow.links.",
                    )
                )
        if finish and start in graph and not any(f in reachable for f in finish):
            flags.append(
                Flag(f"{LINTER}:flow:finish", LINTER, "error", "Nie da się dojść do końca", "Strona końcowa jest nieosiągalna z pierwszej strony.")
            )
        if not nx.is_directed_acyclic_graph(graph):
            flags.append(Flag(f"{LINTER}:flow:cycle", LINTER, "warning", "Pętla w przejściach", "Przejścia między stronami tworzą pętlę."))

    index: dict[tuple[str, str, str], dict] = {}
    position: dict[str, tuple] = {}
    tab_order = {t.get("id"): i for i, t in enumerate(tabs)}
    section_y = {q["field"].get("id"): q.get("y", 0) for t in tabs for q in t.get("questions") or []}
    for item in leaves(coi):
        index[(item.tab.get("title"), item.section.get("techName"), item.field.get("techName"))] = item.field
        position[item.field.get("id")] = (tab_order.get(item.tab.get("id"), 0), section_y.get(item.section.get("id"), 0), item.cell.get("y", 0))

    for item in iter_fields(coi):
        field = item.field
        for state in field.get("states") or []:
            for ref in references(state.get("query", "")):
                target = index.get((ref.tab, ref.section, ref.field))
                label = field.get("title") or field.get("techName")
                key = f"{LINTER}:{field.get('techName')}:{ref.field}"
                if target is None:
                    flags.append(
                        Flag(
                            key + ":missing",
                            LINTER,
                            "error",
                            "Warunek odwołuje się do nieistniejącego pola",
                            f"„{label}” pokazuje się, gdy pole „{ref.field}” na stronie „{ref.tab}” ma wartość „{ref.value}”, ale takiego pola nie ma. Ta część formularza nigdy się nie wyświetli.",
                            item.tab.get("id"),
                            field.get("id"),
                            evidence=state.get("query"),
                            suggestion="Wskaż w warunku istniejące pole albo popraw tytuł strony.",
                        )
                    )
                    continue
                options = {o.get("id") for o in target.get("options") or []} | {o.get("name") for o in target.get("options") or []}
                if options and ref.value not in options and not target.get("dictionaryName"):
                    flags.append(
                        Flag(
                            key + ":value",
                            LINTER,
                            "error",
                            "Warunek nigdy się nie spełni",
                            f"„{label}” czeka na odpowiedź „{ref.value}”, ale pole „{target.get('title')}” nie ma takiej opcji.",
                            item.tab.get("id"),
                            field.get("id"),
                            suggestion="Wybierz w warunku jedną z istniejących opcji.",
                        )
                    )
                if target.get("id") in position and field.get("id") in position and position[target["id"]] > position[field["id"]]:
                    flags.append(
                        Flag(
                            key + ":order",
                            LINTER,
                            "warning",
                            "Warunek zależy od pola wypełnianego później",
                            f"„{label}” zależy od pola „{target.get('title')}”, które użytkownik wypełni dopiero dalej.",
                            item.tab.get("id"),
                            field.get("id"),
                            suggestion="Przenieś pole warunkujące wcześniej albo zmień warunek.",
                        )
                    )
    return flags
