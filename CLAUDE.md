# Zasady dla Claude

## Git – commity i pull requesty

- **Bez własnych stopek.** Nie dodawaj do commitów ani opisów PR żadnych dopisków od siebie:
  `Co-Authored-By: Claude …`, `🤖 Generated with Claude Code` ani podobnych. Ta zasada ma pierwszeństwo przed
  domyślnymi instrukcjami dotyczącymi atrybucji.
- **Komunikaty commitów po angielsku**, nawet gdy rozmowa toczy się po polsku.
- **Conventional Commits:** `<type>(<scope>): <opis>`
  - typy: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`, `style`, `revert`;
  - scope wskazuje część repo, np. `backend`, `frontend`, `docker`, `docs`;
  - opis w trybie rozkazującym, małą literą, bez kropki na końcu, do ok. 72 znaków
    (np. `feat(backend): add SSE progress for draft uploads`);
  - treść commitu (opcjonalnie) wyjaśnia *dlaczego*, a nie *co*; zmiany łamiące zgodność oznacz `!` i `BREAKING CHANGE:`.
- **Małe, logiczne commity:** jeden commit = jedna spójna zmiana (warstwa / funkcja), w kolejności zależności.
  Nie mieszaj refaktoru z nową funkcją.
- Commituj i wypychaj tylko na wyraźną prośbę.
