import type { LintFlag } from "../types";

/**
 * MOCK: flagi z linterów opartych na LLM (trafność cytatu, RODO, WCAG).
 * Na prawdziwym backendzie przychodzą z POST /drafts/{id}/lint.
 *
 * Flagi z linterów „kodowych” (exact-match, static-graph) NIE są tu wpisane –
 * liczy je na żywo src/mocks/mockLinters.ts, żeby edycja w edytorze
 * od razu zmieniała wynik (fajne na demo).
 *
 * Id flagi = `${linter}:${fieldId}` – dzięki temu rozstrzygnięcie urzędnika
 * nie ginie po ponownym uruchomieniu linterów.
 */
export const llmLintFlags: LintFlag[] = [
  {
    id: "citation-relevance:wn_telefon",
    linter: "citation-relevance",
    severity: "warning",
    pageId: "p-wnioskodawca",
    fieldId: "wn_telefon",
    title: "Cytat nie uzasadnia pola „Numer telefonu”",
    message: "Przypisany fragment dotyczy adresu zamieszkania, a nie numeru telefonu. Ocena modelu: fragment nie uzasadnia tego pola.",
    evidence: "„adres zamieszkania” (art. 7 ust. 2)",
    suggestion: "Ustaw pole jako nieobowiązkowe i opisz cel (kontakt w sprawie), albo usuń pole.",
  },
  {
    id: "gdpr:wn_nr_dowodu",
    linter: "gdpr",
    severity: "error",
    pageId: "p-wnioskodawca",
    fieldId: "wn_nr_dowodu",
    title: "Prawdopodobnie nadmiarowa dana: numer dowodu osobistego",
    message:
      "Przepis wymienia numer PESEL, ale nie wymienia numeru dowodu osobistego. Możliwe naruszenie zasady minimalizacji danych.",
    evidence: "Wniosek zawiera imię i nazwisko wnioskodawcy, numer PESEL, adres zamieszkania…",
    suggestion: "Usuń pole albo wskaż przepis (np. rozporządzenie), który go wymaga.",
  },
  {
    id: "wcag:lokal_media",
    linter: "wcag",
    severity: "warning",
    pageId: "p-lokal",
    fieldId: "lokal_media",
    title: "Pytanie wielokrotnie złożone",
    message: "Jedno pytanie dotyczy trzech rzeczy (ogrzewanie, ciepła woda, sposób zasilania). Trudne dla osób z trudnościami poznawczymi.",
    suggestion: "Podziel na dwa pytania: „Czy mieszkanie ma centralne ogrzewanie?” oraz „Czy mieszkanie ma centralną ciepłą wodę?”.",
  },
  {
    id: "wcag:lokal_tytul:dictionary",
    linter: "wcag",
    severity: "info",
    pageId: "p-lokal",
    fieldId: "lokal_tytul",
    title: "Pole może korzystać ze słownika COI",
    message: "Lista opcji wygląda na tytuły prawne do lokalu. W bazie słowników może istnieć gotowa lista.",
    suggestion: "Podepnij słownik (np. TYTUL_PRAWNY_LOKALU) zamiast ręcznie wpisanych opcji.",
  },
];
