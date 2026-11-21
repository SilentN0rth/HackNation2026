# e‑Formularze – identyfikacja wizualna

Logo (koncepcja A: „kartka z pieczęcią”) i podstawy marki. Pełny brand kit (logo, kolory, typografia, głos, interfejs, grafika, slajdy, media) jest na canvasie projektowym zespołu.

## Pliki

```
brand/
  logo/<kolorystyka>/<wersja>.svg   # 7 kolorystyk × 10 wersji, napis zamieniony na krzywe
  logo/favicon.svg
  png/                              # favicon 16/32, apple-touch-icon 180, ikona 512 (granat i złoto)
  tools/brand.py                    # generator SVG (Python + fontTools)
```

**Wersje:** `logo-poziome`, `logo-poziome-haslo`, `logo-pionowe`, `ikona`, `ikona-favicon` (uproszczona, do ≤ 32 px), `ikona-liniowa`, `ikona-aplikacji`, `ikona-okragla`, `napis`, `napis-haslo`.

**Kolorystyki:**

| Folder | Na jakim tle | Kolory |
|---|---|---|
| `granat` | jasne (#f5f7fa, biel) | granat #0b5cad, zieleń #1e7a3c |
| `granat-ciemne-tlo` | ciemne (#0b1f36) | biel, zieleń jasna #3ec46d |
| `granat-mono` | jasne | tylko granat |
| `bialy` | granat lub zdjęcie z ciemnym tłem | tylko biel |
| `czarny` | biel, druk, faks | tylko czerń |
| `zloto-czarne-tlo` | czerń (#0e0e0e) | biel, złoto jasne #d4af37 |
| `zloto-jasne-tlo` | biel | czerń, złoto ciemne #8c6a12 |

Wycięcia w znaku (linie pól, znacznik, odstęp wokół pieczęci) są przezroczyste, więc pliki działają na każdym tle z tabeli.

## Kontrast (WCAG 2.1)

| Para | Kontrast |
|---|---|
| granat #0b5cad na #f5f7fa | 6,2:1 |
| zieleń #1e7a3c na #f5f7fa | 5,0:1 |
| zieleń jasna #3ec46d na #0b1f36 | 7,4:1 |
| złoto jasne #d4af37 na #0e0e0e | 9,2:1 |
| złoto ciemne #8c6a12 na bieli | 5,0:1 |
| obramowanie pól #7b8591 na bieli | 3,75:1 |

Nie używać: granatu na #0b1f36 (2,5:1), zieleni na granacie (1,2:1), jasnego złota na bieli (2,1:1).

## Zasady w skrócie

- Pole ochronne wokół logo = średnica pieczęci.
- Minimum: logo poziome 120 px, ikona 24 px, poniżej 32 px wersja `ikona-favicon`.
- Nie rozciągać, nie obracać, nie zmieniać kolorów, bez cieni.
- Zapis nazwy: „e‑Formularze” (małe e, łącznik, wielkie F).
- Bez godła, flagi i nawiązań do gov.pl czy mObywatela.

## Licencje

Krój Inter: SIL Open Font License 1.1 (zamiana liter na krzywe w logo jest dozwolona). Generator korzysta z fontTools (MIT).

Regeneracja: `npm pack @fontsource/inter@5 && tar xzf fontsource-inter-*.tgz`, potem
`INTER_WOFF_DIR=package/files python brand/tools/brand.py brand/logo`.
