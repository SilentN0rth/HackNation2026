import type { Field, FormSchema, LintFlag, StatuteChunk } from "../types";
import { llmLintFlags } from "./lintFlags";

/**
 * MOCK backendu linterów. Dwa lintery „kodowe” liczymy naprawdę, w przeglądarce,
 * tą samą logiką, którą będzie miał backend (warto ją przenieść 1:1 do Pythona):
 *   - exact-match: czy cytat występuje w tekście ustawy
 *   - static-graph: odwołania warunków do nieistniejących / późniejszych pól
 * Flagi LLM bierzemy ze stałej listy (lintFlags.ts).
 */

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[„”"«»]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function exactMatchFlags(schema: FormSchema, chunks: StatuteChunk[]): LintFlag[] {
  const fullText = normalize(chunks.map((c) => c.text).join(" "));
  const flags: LintFlag[] = [];

  for (const page of schema.pages) {
    for (const field of page.fields) {
      if (!field.legalBasis) {
        flags.push({
          id: `exact-match:${field.id}:missing`,
          linter: "exact-match",
          severity: "warning",
          pageId: page.id,
          fieldId: field.id,
          title: `Brak podstawy prawnej: „${field.label}”`,
          message: "Pole nie ma przypisanego cytatu z przepisu. Obywatel nie zobaczy, dlaczego o to pytamy.",
          suggestion: "Dodaj cytat z ustawy albo ustaw pole jako nieobowiązkowe z opisem celu.",
        });
        continue;
      }
      if (!fullText.includes(normalize(field.legalBasis.quote))) {
        flags.push({
          id: `exact-match:${field.id}`,
          linter: "exact-match",
          severity: "error",
          pageId: page.id,
          fieldId: field.id,
          title: `Potencjalna halucynacja AI: „${field.label}”`,
          message: "Cytatu nie znaleziono w tekście ustawy (dopasowanie słowo w słowo).",
          evidence: `„${field.legalBasis.quote}” (${field.legalBasis.unit})`,
          suggestion: "Popraw cytat na dosłowny fragment przepisu albo usuń pole.",
        });
      }
    }
  }
  return flags;
}

function staticGraphFlags(schema: FormSchema): LintFlag[] {
  const flags: LintFlag[] = [];
  // pozycja każdego pola w kolejności wypełniania
  const order = new Map<string, number>();
  let i = 0;
  for (const p of schema.pages) for (const f of p.fields) order.set(f.id, i++);

  const check = (ownerId: string, ownerLabel: string, pageId: string, cond: Field["visibleIf"], fieldId?: string) => {
    if (!cond) return;
    const target = order.get(cond.fieldId);
    if (target === undefined) {
      flags.push({
        id: `static-graph:${ownerId}:missing-ref`,
        linter: "static-graph",
        severity: "error",
        pageId,
        fieldId,
        title: `Warunek odwołuje się do nieistniejącego pola`,
        message: `„${ownerLabel}” pokazuje się, gdy pole „${cond.fieldId}” = „${String(cond.equals)}”, ale takiego pola nie ma. Ta część formularza nigdy się nie wyświetli (martwa ścieżka).`,
        suggestion: "Wskaż w warunku istniejące pole.",
      });
    } else if (fieldId && target >= (order.get(fieldId) ?? 0)) {
      flags.push({
        id: `static-graph:${ownerId}:forward-ref`,
        linter: "static-graph",
        severity: "error",
        pageId,
        fieldId,
        title: "Warunek zależy od pola wypełnianego później",
        message: `„${ownerLabel}” zależy od pola „${cond.fieldId}”, które obywatel wypełni dopiero dalej.`,
        suggestion: "Przenieś pole warunkujące wcześniej albo zmień warunek.",
      });
    }
  };

  for (const page of schema.pages) {
    check(page.id, page.title, page.id, page.visibleIf);
    for (const f of page.fields) check(f.id, f.label, page.id, f.visibleIf, f.id);
  }
  return flags;
}

/**
 * @param previous poprzednie flagi – przenosimy z nich rozstrzygnięcia urzędnika
 */
export function runMockLinters(schema: FormSchema, chunks: StatuteChunk[], previous: LintFlag[] = []): LintFlag[] {
  const fieldIds = new Set(schema.pages.flatMap((p) => p.fields.map((f) => f.id)));
  const resolutions = new Map(previous.map((f) => [f.id, f.resolution]));

  const llm = llmLintFlags.filter((f) => !f.fieldId || fieldIds.has(f.fieldId));
  const all = [...exactMatchFlags(schema, chunks), ...staticGraphFlags(schema), ...llm];

  return all.map((f) => ({ ...f, resolution: resolutions.get(f.id) ?? f.resolution }));
}
