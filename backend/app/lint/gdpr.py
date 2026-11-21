from app.coi.walk import INPUT_TYPES, leaves
from app.lint.base import Flag
from app.understand.catalog import any_match, catalog

LINTER = "gdpr"
REGISTRY = {"imię", "nazwisko", "pesel", "adres zamieszkania", "data urodzenia"}


def run(coi: dict, meta: dict | None = None) -> list[Flag]:
    meta = meta or {}
    rules = catalog()
    flags: list[Flag] = []
    for item in leaves(coi):
        field = item.field
        if field.get("type") not in INPUT_TYPES:
            continue
        title = field.get("title") or ""
        if any_match(rules.sensitive, title.lower()) and not (meta.get(field.get("id")) or {}).get("legalBasis"):
            flags.append(
                Flag(
                    f"{LINTER}:{field.get('techName')}:sensitive",
                    LINTER,
                    "warning",
                    f"Czy to pole jest potrzebne: „{title}”?",
                    "To dana osobowa, o którą formularz pyta bez wskazanej podstawy prawnej. Zasada minimalizacji (art. 5 RODO) pozwala zbierać tylko dane niezbędne do sprawy.",
                    item.tab.get("id"),
                    field.get("id"),
                    suggestion="Usuń pole albo wskaż przepis, który go wymaga.",
                )
            )
        if item.tab.get("title") != "Dane" and title.lower() in REGISTRY and not field.get("defaultValue"):
            flags.append(
                Flag(
                    f"{LINTER}:{field.get('techName')}:registry",
                    LINTER,
                    "info",
                    "Dane dostępne w rejestrze",
                    f"„{title}” można pobrać z rejestru PESEL zamiast prosić o nie ponownie.",
                    item.tab.get("id"),
                    field.get("id"),
                    suggestion="Ustaw dane inicjalne z rejestru albo usuń pole, bo jest już na stronie „Dane”.",
                )
            )
    return flags
