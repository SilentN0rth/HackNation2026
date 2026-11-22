"""Dane inicjalne (materiał „Dane inicjalne” do zadania rozszerzającego): źródła i atrybuty, którymi można zasilić pole.

Pole zasilane z rejestru ma `defaultValueType: EXTERNAL_SYSTEM`, `readOnly: true`
i `defaultValue` w postaci `ŹRÓDŁO.atrybut`, np. `PESEL.name`. Jedno pole = jedno źródło i jeden atrybut.
"""

from __future__ import annotations

EXTERNAL_SYSTEM = "EXTERNAL_SYSTEM"

SOURCES: dict[str, str] = {
    "PESEL": "Rejestr PESEL",
    "PESEL_ADDRESS": "Dane zameldowania",
    "MLPZ": "Dane zalogowanego użytkownika",
}

PESEL = {
    "pesel": "Pesel z PESEL",
    "name": "Imię z PESEL",
    "surname": "Nazwisko z PESEL",
    "birthDate": "Data urodzenia z PESEL",
    "citizenship": "Narodowość z PESEL",
    "motherName": "Imię matki z PESEL",
    "birthPlace": "Miejsce urodzenia z PESEL",
    "motherSurname": "Nazwisko matki z PESEL",
    "sex": "Płeć z PESEL",
    "fatherName": "Imię ojca z PESEL",
    "secondName": "Drugie imię z PESEL",
    "birthCountry": "Kraj urodzenia z PESEL",
    "foreignBirthUSC": "Zagraniczne miasto USC urodzenia z PESEL",
    "familyName": "Nazwisko rodowe z PESEL",
    "fatherSurname": "Nazwisko ojca z PESEL",
    "maritalStatus": "Stan cywilny z PESEL",
}

_ADDRESS_PARTS = {
    "Voivodeship": "województwo",
    "District": "region",
    "Community": "gmina",
    "Place": "miejscowość",
    "StreetType": "typ ulicy",
    "Street": "ulica",
    "HouseNumber": "numer domu",
    "ApartmentNumber": "numer lokalu",
    "PostalCode": "kod pocztowy",
}

PESEL_ADDRESS = {
    f"{kind}Address{part}": f"{label} adres zameldowania: {name} z PESEL"
    for kind, label in (("temporary", "Tymczasowy"), ("permanent", "Stały"))
    for part, name in _ADDRESS_PARTS.items()
}

MLPZ = {
    "name": "Imię z MLPZ",
    "secondName": "Drugie imię z MLPZ",
    "surname": "Nazwisko z MLPZ",
    "pesel": "Wartość PESEL z MLPZ",
    "phoneNumber": "Numer telefonu z MLPZ",
    "email": "Adres email z MLPZ",
    "country": "Kraj z MLPZ",
    "voivodeship": "Województwo z MLPZ",
    "district": "Dzielnica z MLPZ",
    "community": "Gmina z MLPZ",
    "place": "Miejscowość z MLPZ",
    "postCode": "Kod pocztowy z MLPZ",
    "street": "Ulica z MLPZ",
    "building": "Nr budynku z MLPZ",
    "apartment": "Nr lokalu z MLPZ",
    "institutionName": "Nazwa Organizacji z MLPZ",
    "descriptiveOrganizationName": "Opisowa nazwa organizacji z MLPZ",
}

ATTRIBUTES: dict[str, dict[str, str]] = {"PESEL": PESEL, "PESEL_ADDRESS": PESEL_ADDRESS, "MLPZ": MLPZ}

# birthDate to jedyny atrybut typu Datepicker; pozostałe są polami tekstowymi.
DATE_ATTRIBUTES = {"PESEL.birthDate"}


def all_keys() -> list[str]:
    return [f"{source}.{attr}" for source, attrs in ATTRIBUTES.items() for attr in attrs]


def check(value: object) -> str | None:
    """Zwraca opis błędu wartości `defaultValue` pola zasilanego z rejestru albo None, gdy jest poprawna."""
    if not isinstance(value, str) or value.count(".") != 1:
        return "wartość musi mieć postać ŹRÓDŁO.atrybut (jedno źródło i jeden atrybut), np. PESEL.name"
    source, attr = value.split(".")
    if source not in SOURCES:
        return f"nieznane źródło „{source}” (dostępne: {', '.join(SOURCES)})"
    if attr not in ATTRIBUTES[source]:
        return f"źródło {source} nie ma atrybutu „{attr}”"
    return None
