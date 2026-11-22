# Otwarte problemy

Stan na 2026-11-22. Kontekst: `docs/PRZEGLAD_POPRAWEK.md`.

## Decyzje przyjęte (zgodnie z regułami organizatora)
- Pola zasilane z rejestru (`EXTERNAL_SYSTEM`, np. dane z `MLPZ`) są tylko do odczytu, jak wymaga PDF „Dane inicjalne”. Skutek: gdy rejestr nie ma telefonu lub adresu, obywatel nie wpisze ich ręcznie. Standardy mówią, że dane kontaktowe można poprawiać; jeśli wolicie odwrotnie, zmieńcie `readOnly` w `standard.json` (reguła `external-not-readonly` w `quality.py` też trzeba wtedy zdjąć).
- Strona końcowa używa `INFO_SECTION` (reguły techniczne). Wzorce organizatora mają `TEXT_BLOCK`; walidator traktuje to tylko jako ostrzeżenie.
- Adres: jedno pole słownikowe `TERYT_4G_DOWODOWY` (tak opisują to standardy i wzorzec organizatora), we wszystkich adresach.

## Ograniczenia, których nie da się naprawić po naszej stronie
1. **KRS:** lista walidatorów COI nie zawiera wzorca `^\d{10}$`; pole ma opis „Wpisz 10 cyfr”.
2. **Formularz 6:** źródło nie podaje miejscowości urzędu („Urząd Miasta i Gminy”); raport zgłasza `organ-name`. Wpisz nazwę ręcznie po konwersji.
3. **Formularz 9:** jedna etykieta ma ponad 120 znaków (tekst z papieru).
4. Sekcje powyżej 14 pól są dzielone mechanicznie („część 1 z 3”), a nie po temacie.
5. Strona wariantu jest ukrywana tylko przy jednym prostym warunku; pole z własnym warunkiem dziedziczy warunek sekcji.

## Niesprawdzone
6. Pełny przegląd WCAG treści formularzy w przeglądarce.
7. Wgrywanie plików przez Payload (kolekcja `attachments`) nie ma testu e2e.
