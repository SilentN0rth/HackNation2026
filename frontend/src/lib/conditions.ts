import type { Condition, FormPage, FormSchema } from "../types";

export type Values = Record<string, string | boolean>;

export function isVisible(cond: Condition | undefined, values: Values): boolean {
  if (!cond) return true;
  return values[cond.fieldId] === cond.equals;
}

/** Strony i pola widoczne dla aktualnych odpowiedzi obywatela. */
export function visiblePages(schema: FormSchema, values: Values): FormPage[] {
  return schema.pages
    .filter((p) => isVisible(p.visibleIf, values))
    .map((p) => ({ ...p, fields: p.fields.filter((f) => isVisible(f.visibleIf, values)) }));
}
