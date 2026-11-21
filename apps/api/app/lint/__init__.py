from app.lint import dictionaries, gdpr, static_graph, wcag

SEVERITY_ORDER = {"error": 0, "warning": 1, "info": 2}


def run(coi: dict, meta: dict | None = None) -> list[dict]:
    flags = [*static_graph.run(coi), *gdpr.run(coi, meta), *wcag.run(coi), *dictionaries.run(coi)]
    unique: dict[str, dict] = {}
    for flag in flags:
        unique.setdefault(flag.id, flag.as_dict())
    return sorted(unique.values(), key=lambda f: (SEVERITY_ORDER[f["severity"]], f["id"]))
