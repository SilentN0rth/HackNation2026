"""Linter `static-graph` – logika formularza bez LLM.

1. Graf stron (networkx na flow.links): osiągalność strony końcowej, cykle, strony bez wejścia.
2. Warunki JSONata (states): czy wskazana strona, sekcja i pole istnieją, czy wartość jest wśród opcji pola.
3. Symulacja (jsonata-python): czy warunek jest spełniony dla jakiejkolwiek odpowiedzi → inaczej martwe pole.
"""

import itertools
from typing import Any

import jsonata
import networkx as nx

from app.coi.jsonata import ShowRef, parse_query
from app.lint.base import FieldRef, LintContext, LintFlag, flag

MAX_COMBINATIONS = 256


def _sim_doc(answers: dict[ShowRef, Any]) -> dict[str, Any]:
    """Minimalny dokument z odpowiedziami użytkownika dla wszystkich pól, do których odwołuje się warunek."""
    tabs: dict[str, dict[str, list[dict[str, Any]]]] = {}
    for ref, answer in answers.items():
        tabs.setdefault(ref.tab_title, {}).setdefault(ref.section_tech, []).append(
            {"field": {"techName": ref.field_tech, "__userAnswer": answer}})
    return {"tabs": [{"title": t, "questions": [{"field": {"techName": s, "repeatingSectionGrid": grid}}
                                               for s, grid in secs.items()]} for t, secs in tabs.items()]}


def _is_satisfiable(query: str, candidates: dict[ShowRef, list[Any]]) -> bool:
    expr = jsonata.Jsonata(query)
    refs = list(candidates)
    for combo in itertools.islice(itertools.product(*(candidates[r] for r in refs)), MAX_COMBINATIONS):
        if expr.evaluate(_sim_doc(dict(zip(refs, combo, strict=True)))):
            return True
    return False


def _graph_flags(ctx: LintContext) -> list[LintFlag]:
    tabs = ctx.coi.get("tabs", [])
    if not tabs:
        return []
    g = nx.DiGraph()
    g.add_nodes_from(t["id"] for t in tabs)
    for link in ctx.coi.get("flow", {}).get("links", []):
        g.add_edge(link["source"], link["target"])
    out: list[LintFlag] = []
    title = {t["id"]: t["title"] for t in tabs}
    start = tabs[0]["id"]
    finish = [t["id"] for t in tabs if t.get("type") == "FINISH"]
    reachable = nx.descendants(g, start) | {start} if start in g else set()
    for f in finish:
        if f not in reachable:
            out.append(flag("static-graph", "error", "Strona końcowa nieosiągalna",
                            f"Ze strony „{title[start]}” nie da się dojść do strony końcowej „{title[f]}”.",
                            rule=f"finish-unreachable-{f[:8]}"))
    for t in tabs[1:]:
        if t["id"] not in reachable:
            out.append(flag("static-graph", "error", "Strona bez wejścia",
                            f"Na stronę „{t['title']}” nie prowadzi żadne przejście (flow.links).",
                            rule=f"orphan-{t['id'][:8]}"))
    for cycle in list(nx.simple_cycles(g))[:5]:
        names = " → ".join(title.get(n, n) for n in cycle)
        out.append(flag("static-graph", "warning", "Pętla w przepływie stron", f"Strony tworzą pętlę: {names}.",
                        rule=f"cycle-{cycle[0][:8]}"))
    return out


def _condition_flags(ctx: LintContext) -> list[LintFlag]:
    out: list[LintFlag] = []
    tabs = {t["title"]: t for t in ctx.coi.get("tabs", [])}
    holders: list[FieldRef] = []
    for tab in ctx.coi.get("tabs", []):
        for q in tab.get("questions", []):
            sec = q["field"]
            holders.append(FieldRef(tab, sec, sec, ctx.meta.get(sec.get("techName", ""), {})))
            for c in sec.get("repeatingSectionGrid") or []:
                holders.append(FieldRef(tab, sec, c["field"], ctx.meta.get(c["field"].get("techName", ""), {})))

    for holder in holders:
        for si, state in enumerate(holder.field.get("states") or []):
            refs = parse_query(state.get("query", ""))
            candidates: dict[ShowRef, list[Any]] = {}
            broken = False
            for i, ref in enumerate(refs):
                rule = f"s{si}c{i}"
                tab = tabs.get(ref.tab_title)
                if tab is None:
                    out.append(flag("static-graph", "error", "Warunek wskazuje nieistniejącą stronę",
                                    f"Warunek pola „{holder.label or holder.tech}” odwołuje się do strony "
                                    f"„{ref.tab_title}”, której nie ma (zmieniono tytuł strony?).", holder, rule,
                                    evidence=state["query"], suggestion="Popraw tytuł strony w warunku."))
                    broken = True
                    continue
                sec = next((q["field"] for q in tab["questions"] if q["field"].get("techName") == ref.section_tech),
                           None)
                if sec is None:
                    out.append(flag("static-graph", "error", "Warunek wskazuje nieistniejącą sekcję",
                                    f"Warunek pola „{holder.label or holder.tech}” odwołuje się do sekcji "
                                    f"„{ref.section_tech}” na stronie „{ref.tab_title}”, której tam nie ma.", holder,
                                    rule, evidence=state["query"]))
                    broken = True
                    continue
                target = next((c["field"] for c in sec.get("repeatingSectionGrid") or []
                               if c["field"].get("techName") == ref.field_tech), None)
                if target is None:
                    out.append(flag("static-graph", "error", "Warunek wskazuje nieistniejące pole",
                                    f"Warunek pola „{holder.label or holder.tech}” odwołuje się do pola "
                                    f"„{ref.field_tech}”, którego nie ma w sekcji „{sec.get('title')}”.", holder, rule,
                                    evidence=state["query"], suggestion="Wybierz właściwe pole w edytorze."))
                    broken = True
                    continue
                options = [o.get("name") or o.get("id") for o in target.get("options") or []]
                if target.get("dictionaryName") or not options:
                    # opcje ze słownika COI (np. „Polska” w „Kraje”) – nie znamy ich lokalnie, zakładamy że wartość jest
                    candidates[ref] = [ref.value, "", None]
                    continue
                if ref.value not in options:
                    out.append(flag("static-graph", "error", "Warunek z nieistniejącą odpowiedzią",
                                    f"Pole „{holder.label or holder.tech}” pokaże się, gdy w „{target.get('title')}” "
                                    f"wybrano „{ref.value}”, ale takiej opcji nie ma ({', '.join(options)}).", holder,
                                    rule, evidence=state["query"]))
                    broken = True
                    continue
                candidates[ref] = [*options, [*options], None]
            if broken or not candidates:
                continue
            try:
                shown = _is_satisfiable(state["query"], candidates)
            except Exception:  # błąd składni / obliczenia JSONata
                out.append(flag("static-graph", "error", "Niepoprawny warunek JSONata",
                                f"Warunku pola „{holder.label or holder.tech}” nie da się obliczyć.", holder,
                                f"s{si}", evidence=state["query"]))
                continue
            if not shown:
                out.append(flag("static-graph", "warning", "Martwe pole",
                                f"Pole „{holder.label or holder.tech}” nie pokaże się dla żadnej odpowiedzi.",
                                holder, f"s{si}", evidence=state["query"]))
    return out


def lint_static_graph(ctx: LintContext) -> list[LintFlag]:
    return _graph_flags(ctx) + _condition_flags(ctx)
