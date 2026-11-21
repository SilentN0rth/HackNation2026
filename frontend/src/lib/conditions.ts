import type { Condition, FormPage, FormSchema } from "../types";

export type Values = Record<string, string | boolean>;

export function isVisible(cond: Condition | undefined, values: Values): boolean {
  if (!cond) return true;
  const match = values[cond.fieldId] === cond.equals;
  return cond.negate ? !match : match;
}

export function visiblePages(schema: FormSchema, values: Values): FormPage[] {
  return schema.pages
    .filter((p) => isVisible(p.visibleIf, values))
    .map((p) => ({ ...p, fields: p.fields.filter((f) => isVisible(f.visibleIf, values)) }));
}
