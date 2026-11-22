import { z } from "zod";
import type { Field } from "../types";

function isValidPesel(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = w.reduce((acc, weight, i) => acc + weight * Number(value[i]), 0);
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}

const REQUIRED = "To pole jest wymagane.";

const PATTERNS: Partial<Record<Field["type"], { re: RegExp; message: string }>> = {
  postalCode: { re: /^\d{2}-\d{3}$/, message: "Wpisz kod w formacie 00-000." },
  phone: { re: /^(\+48)?\s?\d{3}\s?\d{3}\s?\d{3}$/, message: "Wpisz 9 cyfr numeru telefonu." },
  email: { re: z.regexes.email, message: "Wpisz poprawny adres e-mail." },
};

function textSchema(field: Field): z.ZodType<string> {
  const v = field.validation ?? {};
  let s = z.string();
  const p = PATTERNS[field.type];
  if (p) s = s.regex(p.re, p.message);
  if (v.minLength !== undefined) s = s.min(v.minLength, `Wpisz co najmniej ${v.minLength} znaków.`);
  if (v.maxLength !== undefined) s = s.max(v.maxLength, `Możesz wpisać najwyżej ${v.maxLength} znaków.`);
  if (v.pattern) s = s.regex(new RegExp(v.pattern), v.patternMessage ?? "Niepoprawny format.");

  let out: z.ZodType<string> = s;
  if (field.type === "pesel") out = out.refine(isValidPesel, "Numer PESEL jest niepoprawny. Sprawdź cyfry.");
  if (field.type === "number") {
    out = out.superRefine((raw, ctx) => {
      const n = Number(raw.replace(",", "."));
      if (Number.isNaN(n)) return ctx.addIssue({ code: "custom", message: "Wpisz liczbę." });
      if (v.min !== undefined && n < v.min)
        ctx.addIssue({ code: "custom", message: `Wartość nie może być mniejsza niż ${v.min}.` });
      if (v.max !== undefined && n > v.max)
        ctx.addIssue({ code: "custom", message: `Wartość nie może być większa niż ${v.max}.` });
    });
  }
  return out;
}

function fieldValueSchema(field: Field): z.ZodType<string | boolean | undefined> {
  const filled = textSchema(field);
  return z.union([z.string(), z.boolean(), z.undefined()]).superRefine((val, ctx) => {
    const empty = val === undefined || val === "" || val === false;
    if (empty) {
      if (field.required) ctx.addIssue({ code: "custom", message: REQUIRED });
      return;
    }
    if (typeof val === "boolean") return; // zaznaczony checkbox
    const r = filled.safeParse(val);
    if (!r.success) for (const i of r.error.issues) ctx.addIssue({ code: "custom", message: i.message });
  });
}

export function validateField(field: Field, value: string | boolean | undefined): string | null {
  // Pole z rejestru jest tylko do odczytu: gdy źródło nie ma danych, obywatel nie może ich dopisać, więc nie wymagamy wartości.
  if (field.prefill && (value === undefined || value === "")) return null;
  const r = fieldValueSchema(field).safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? "Niepoprawna wartość.");
}

export const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ods", ".xlsx", ".jpg", ".jpeg", ".png"];
const FORBIDDEN_CHARS = /[;:></\\|'*%$]/;
export const MAX_FILE_MB = 20; // backend ma własny, konfigurowalny limit – to tylko podpowiedź w UI

const extOf = (name: string) => name.slice(name.lastIndexOf(".")).toLowerCase();

const uploadFileSchema = z
  .custom<File>((f) => typeof File !== "undefined" && f instanceof File, "Wybierz plik.")
  .refine((f) => ACCEPTED_EXTENSIONS.includes(extOf(f.name)), {
    error: `Nieobsługiwany format. Dozwolone: ${ACCEPTED_EXTENSIONS.join(", ")}.`,
    abort: true,
  })
  .refine((f) => f.name.length <= 250, { error: "Nazwa pliku może mieć najwyżej 250 znaków.", abort: true })
  .refine((f) => !FORBIDDEN_CHARS.test(f.name), {
    error: "Nazwa pliku zawiera niedozwolone znaki: ; : > < / \\ | ' * % $",
    abort: true,
  })
  .refine((f) => f.size <= MAX_FILE_MB * 1024 * 1024, `Plik jest większy niż ${MAX_FILE_MB} MB.`);

export function validateUploadFile(file: File): string | null {
  const r = uploadFileSchema.safeParse(file);
  return r.success ? null : (r.error.issues[0]?.message ?? "Niepoprawny plik.");
}

export const justificationSchema = z
  .string()
  .trim()
  .min(10, "Napisz w co najmniej 10 znakach, dlaczego odrzucasz uwagę.")
  .max(500, "Uzasadnienie może mieć najwyżej 500 znaków.");
