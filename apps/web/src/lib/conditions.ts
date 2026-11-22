import type { Condition, ConditionExpr, FormPage, FormSchema } from "../types";

export type Values = Record<string, string | boolean>;

function isVisible(cond: Condition | undefined, values: Values): boolean {
  if (!cond) return true;
  const match = values[cond.fieldId] === cond.equals;
  return cond.negate ? !match : match;
}

function evaluate(expr: ConditionExpr | undefined, values: Values): boolean {
  if (!expr) return true;
  if ("allOf" in expr) return expr.allOf.every((part) => evaluate(part, values));
  if ("anyOf" in expr) return expr.anyOf.some((part) => evaluate(part, values));
  return isVisible(expr, values);
}

export function isLocked(field: { readOnlyIf?: Condition }, values: Values): boolean {
  const cond = field.readOnlyIf;
  return Boolean(cond) && isVisible(cond, values);
}

export function visiblePages(schema: FormSchema, values: Values): FormPage[] {
  return schema.pages
    .filter((p) => isVisible(p.visibleIf, values))
    .map((p) => ({ ...p, fields: p.fields.filter((f) => isVisible(f.visibleIf, values) && evaluate(f.visibleWhen, values)) }));
}
