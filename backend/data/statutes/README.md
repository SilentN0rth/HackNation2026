# Korpus ustaw (dla „Dlaczego pytamy?” i lintera exact-match)

Jeden plik `.txt` (UTF-8) na akt. Nazwa pliku = identyfikator, np. `oplata_skarbowa.txt`.

```
Ustawa z dnia 16 listopada 2006 r. o opłacie skarbowej      ← 1. linia: pełny tytuł aktu
Art. 1. 1. Opłacie skarbowej podlega: …                      ← dalej tekst jednolity z ISAP, BEZ zmian
1) dokonanie czynności urzędowej: …
```

- Tekst pobieramy z ISAP/ELI **przed** demo (zakaz zewnętrznych API w trakcie działania).
- **Dosłownie** – nie poprawiać, nie streszczać. Inaczej teza „sprawdzamy cytaty” się sypie.
- Parser (`app/legal/parser.py`) sam dzieli tekst na art. / ust. / pkt.

Wstępna lista (z BACKEND_PLAN.md, sekcja 7): Ordynacja podatkowa (5), ustawa o opłacie skarbowej (2),
KPA art. 217+ (3), ustawa o drogach publicznych + rozporządzenie o zajęciu pasa (6), ustawa o ochronie zwierząt +
rozporządzenie o rasach psów agresywnych (7), ustawa o utrzymaniu czystości i porządku w gminach (8),
Prawo geodezyjne i kartograficzne + rozporządzenie o numeracji porządkowej (1), ustawa o sporcie (9).
