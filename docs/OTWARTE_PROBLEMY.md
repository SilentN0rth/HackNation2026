# Otwarte problemy (do późniejszego opracowania)

Stan na 2026-11-22. Kontekst: `docs/PRZEGLAD_POPRAWEK.md` (przegląd i status wdrożenia).

## Blokery i decyzje
1. **Push branchu `fix/coi-standards-and-quality` zablokowany** przez system uprawnień. Wypchnąć ręcznie: `git push -u origin fix/coi-standards-and-quality`, potem PR.
2. **Decyzje do potwierdzenia:** pola adresu z `MLPZ` edytowalne (PDF „Dane inicjalne” mówi: tylko do odczytu); `INFO_SECTION` zamiast `TEXT_BLOCK` na stronie końcowej (wzorce organizatora używają `TEXT_BLOCK`).

## Funkcje, których brakuje
3. **Upload plików u obywatela (prawie gotowe):** endpoint `POST /attachments` (limit 10 MB, PDF/JPG/PNG/XML, kontrola sygnatury, tylko własne pliki), pole `file` wysyła plik i zapisuje „id|nazwa”. Domyślny backend aplikacji to Payload (`payloadApi`), który nie ma `uploadAttachment`, więc tam zapisuje się tylko nazwa pliku. Brakuje też limitu liczby plików i listy formatów per pole oraz testu e2e.
4. **Checkboxy „Brak nazwy ulicy” / „Brak numeru lokalu”** (standard adresu). Obecnie te pola są nieobowiązkowe.
5. **KRS:** standard wymaga wzorca `^\d{10}$`, ale lista walidatorów COI go nie zawiera. Pole ma tylko opis „Wpisz 10 cyfr”.
6. **Adres:** standard opisuje 4 zależne listy (województwo, powiat, gmina, miejscowość); mamy jedno pole słownikowe. Adres „innej osoby” używa `TERYT_DOWODOWY` (3 poziomy), główny `TERYT_4G_DOWODOWY`. Wzorce organizatora też się różnią (nr 1: 3 poziomy, nr 5: 4). Ujednolicić.

## Jakość konwersji
7. **Formularze 8 i 9 (w większości rozwiązane):** nr 9 ma pytanie „Rodzaj wniosku” i strony widoczne tylko dla wybranego rodzaju (stypendium, nagroda, wyróżnienie), a tytuł obejmuje wszystkie trzy. Duże sekcje są dzielone mechanicznie na części („część 1 z 3”), więc nie zawsze po temacie. W nr 8 zostaje strona o nazwie „Gdynia”, a w nr 9 jedna etykieta ponad 120 znaków. Sekcje z `visibleWhen` ukrywają całą stronę tylko przy jednym prostym warunku. Pola z własnym warunkiem w sekcji wariantu dziedziczą warunek sekcji.
8. **Tytuły stron generyczne:** „Szczegóły wniosku” i „Kontakt i zgody”, a wzorzec nr 1 ma tematyczne („Informacje o budynku”, „Kontakt z urzędem”).
9. **Nazwa organu** niepełna w nr 6 („Urząd Miasta i Gminy” bez miejscowości); brak flagi ostrzegawczej.
10. **Tytuły 8 i 9 skrócone** (brak „za gospodarowanie odpadami komunalnymi”, „nagrody lub wyróżnienia sportowego”).
11. **Pliki:** nazwy i tytuły uploadów różnią się od wzorca nr 1 (nasze zgodne ze standardami).

## Niesprawdzone / do zrobienia
12. Testy e2e (Playwright) i ręczne przejście ścieżek „Swoim / Innej osoby / Osoby prawnej (Pełnomocnik, Reprezentant)” w przeglądarce.
13. Walidacja pełnym JSON Schema z materiałów organizatora.
14. Lint językowy i WCAG dla treści formularzy, słownik „Numery kierunkowe” przy telefonach, propozycje nowych słowników.
15. Skrypt `check:outputs` w CI (walidator + jakość + porównanie ze wzorcami).
