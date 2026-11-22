import { z } from "zod";
import type { Field } from "../types";

function isValidPesel(value: string): boolean {
  if (!/^\d{11}$/.test(value)) return false;
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  const sum = w.reduce((acc, weight, i) => acc + weight * Number(value[i]), 0);
  return (10 - (sum % 10)) % 10 === Number(value[10]);
}

function isValidNip(value: string): boolean {
  if (!/^\d{10}$/.test(value)) return false;
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const sum = w.reduce((acc, weight, i) => acc + weight * Number(value[i]), 0);
  return sum % 11 === Number(value[9]);
}

function isValidRegon(value: string): boolean {
  if (!/^(\d{9}|\d{14})$/.test(value)) return false;
  const check = (digits: string, weights: number[]) => {
    const sum = weights.reduce((acc, weight, i) => acc + weight * Number(digits[i]), 0);
    return (sum % 11) % 10 === Number(digits[weights.length]);
  };
  const ok9 = check(value, [8, 9, 2, 3, 4, 5, 6, 7]);
  return value.length === 9 ? ok9 : ok9 && check(value, [2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8]);
}

/**
 * NIP, REGON i KRS to pola tekstowe (typ „text”), więc rozpoznajemy je po etykiecie ze standardu
 * (sekcja „Dane podmiotu”). Etykiety w schemacie pochodzą z generatora, nie z danych obywatela.
 */
function identifierKind(field: Field): "nip" | "regon" | "krs" | null {
  if (field.type !== "text") return null;
  const label = field.label.trim().toLowerCase();
  if (label === "nip" || label === "numer nip") return "nip";
  if (label === "regon" || label === "numer regon") return "regon";
  if (label === "numer krs" || label === "krs") return "krs";
  return null;
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
  const id = identifierKind(field);
  if (id === "nip") out = out.refine(isValidNip, "Numer NIP jest niepoprawny. Wpisz 10 cyfr bez myślników.");
  if (id === "regon") out = out.refine(isValidRegon, "Numer REGON jest niepoprawny. Wpisz 9 lub 14 cyfr.");
  if (id === "krs") out = out.refine((raw) => /^\d{10}$/.test(raw), "Wpisz 10 cyfr.");
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
  if (field.type === "info") return null;
  // Pole z rejestru jest tylko do odczytu: gdy źródło nie ma danych, obywatel nie może ich dopisać, więc nie wymagamy wartości.
  if (field.prefill && (value === undefined || value === "")) return null;
  const r = fieldValueSchema(field).safeParse(value);
  return r.success ? null : (r.error.issues[0]?.message ?? "Niepoprawna wartość.");
}

export const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".ods", ".xlsx", ".jpg", ".jpeg", ".png", ".json"];
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

/* ---------- pliki obywatela: formaty i limit ze standardu (sekcje Pełnomocnictwo i Opłata skarbowa) ---------- */

export const CITIZEN_FILE_MAX_MB = 10;

/** Potwierdzenie przelewu przyjmujemy tylko jako PDF; pozostałe załączniki jako PDF, obraz lub XML. */
export function citizenFileFormats(field: Pick<Field, "label">): string[] {
  return /potwierdzeni\w* przelewu/i.test(field.label) ? ["pdf"] : ["pdf", "jpg", "jpeg", "png", "xml"];
}

/** Zdanie pod etykietą pola pliku, np. „Dozwolone formaty: PDF, JPG. Maksymalny rozmiar: 10 MB.” */
export function citizenFileHint(field: Pick<Field, "label">): string {
  const formats = citizenFileFormats(field).map((f) => f.toUpperCase());
  return `Dozwolone formaty: ${formats.join(", ")}. Maksymalny rozmiar: ${CITIZEN_FILE_MAX_MB} MB.`;
}

export function validateCitizenFile(field: Pick<Field, "label">, file: Pick<File, "name" | "size">): string | null {
  const formats = citizenFileFormats(field);
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".") + 1).toLowerCase() : "";
  if (!formats.includes(ext)) return `Ten format pliku nie jest obsługiwany. Dodaj plik: ${formats.map((f) => f.toUpperCase()).join(", ")}.`;
  if (file.size > CITIZEN_FILE_MAX_MB * 1024 * 1024) return `Plik może mieć najwyżej ${CITIZEN_FILE_MAX_MB} MB.`;
  return null;
}

export const justificationSchema = z
  .string()
  .trim()
  .min(10, "Napisz w co najmniej 10 znakach, dlaczego odrzucasz uwagę.")
  .max(500, "Uzasadnienie może mieć najwyżej 500 znaków.");
