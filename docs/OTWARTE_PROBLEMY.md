# Otwarte problemy (do późniejszego opracowania)

Stan na 2026-11-22. Kontekst: `docs/PRZEGLAD_POPRAWEK.md`.

## Do zrobienia ręcznie lub decyzje
1. **Push branchu** `fix/coi-standards-and-quality` zablokowany przez uprawnienia: `git push -u origin fix/coi-standards-and-quality`, potem PR.
2. **Przyjęte decyzje (do potwierdzenia):** pola adresu z `MLPZ` zostają edytowalne (PDF „Dane inicjalne” mówi: tylko do odczytu, standardy: użytkownik poprawia dane); `INFO_SECTION` zamiast `TEXT_BLOCK` na stronie końcowej (wzorce używają `TEXT_BLOCK`, w walidatorze to ostrzeżenie).

## Funkcje
3. **Upload w Payloadzie:** domyślny backend (`payloadApi`) zapisuje tylko nazwę pliku. Pełna wysyłka działa przy FastAPI (`POST /attachments`) i w mocku. Brak też limitu liczby plików i listy formatów per pole.
4. **KRS:** lista walidatorów COI nie zawiera wzorca `^\d{10}$`; pole ma tylko opis „Wpisz 10 cyfr”.
5. **Adres:** jedno pole słownikowe `TERYT_4G_DOWODOWY` zamiast czterech zależnych list (województwo, powiat, gmina, miejscowość). Wszystkie adresy używają już tego samego słownika.

## Jakość konwersji
6. **Formularz 8:** strona „Gdynia” (nazwa z papieru); duże sekcje są dzielone mechanicznie na części, nie tematycznie.
7. **Formularz 9:** jedna etykieta powyżej 120 znaków.
8. **Formularz 6:** nazwa urzędu bez miejscowości („Urząd Miasta i Gminy”); ostrzeżenie `organ-name` w raporcie. Źródło nie podaje nazwy.
9. **Tytuły stron** generyczne („Szczegóły wniosku”, „Kontakt i zgody”), a wzorzec ma tematyczne.
10. **Tytuły 8 i 9** bez pełnego opisu usługi (nr 8).
11. Pola w sekcji wariantu z własnym warunkiem dziedziczą warunek sekcji; strona jest ukrywana tylko przy jednym prostym warunku.

## Niesprawdzone
12. Testy e2e (Playwright) i ręczne przejście ścieżek w przeglądarce (Swoim / Innej osoby / Osoby prawnej: Pełnomocnik, Reprezentant; wybór rodzaju wniosku w nr 9; checkboxy „Brak…”).
13. Walidacja pełnym JSON Schema z materiałów organizatora.
14. Lint WCAG treści, słownik „Numery kierunkowe” przy telefonach, propozycje nowych słowników.
15. Skrypt `check:outputs` w CI.
