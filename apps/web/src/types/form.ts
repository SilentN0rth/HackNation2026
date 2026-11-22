import { z } from "zod";

/**
 * Wewnętrzny model formularza używany przez frontend.
 *
 * Schematy Zod są JEDYNYM źródłem prawdy: typy TS wyprowadzamy przez z.infer,
 * a te same schematy walidują odpowiedzi backendu w src/api/httpApi.ts.
 *
 * UWAGA: COI ma własny, docelowy format JSON (przykłady na Discordzie,
 * kanał „Cyfryzacja formularzy / materiały-dodatkowe”). Nie zmieniajcie
 * tych typów pod COI – mapowanie robi się w jednym miejscu:
 * src/api/adapters.ts (toCoiJson / fromCoiJson).
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "date",
  "select",
  "radio",
  "checkbox",
  "pesel",
  "postalCode",
  "phone",
  "email",
  "file",
] as const;
export const FieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof FieldTypeSchema>;

export const OptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type Option = z.infer<typeof OptionSchema>;

/** Podstawa prawna pola – serce wyróżnika „dlaczego pytamy?”. */
export const LegalBasisSchema = z.object({
  /** Pełna nazwa aktu, np. „Ustawa z dnia … o dodatkach mieszkaniowych”. */
  act: z.string(),
  /** Jednostka redakcyjna z PARSERA (nie z LLM), np. „art. 7 ust. 1 pkt 2”. */
  unit: z.string(),
  /** Dosłowny cytat, który sprawdza linter Exact String Match. */
  quote: z.string(),
  /** Id fragmentu (chunka) w bazie wektorowej, z którego pochodzi cytat. */
  chunkId: z.string().optional(),
});
export type LegalBasis = z.infer<typeof LegalBasisSchema>;

/** Pole/strona pokazuje się tylko, gdy warunek jest spełniony. */
export const ConditionSchema = z.object({
  fieldId: z.string(),
  equals: z.union([z.string(), z.boolean()]),
  negate: z.boolean().optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

/** Warunek złożony (z sekcji COI): wszystkie (`allOf`) albo którykolwiek (`anyOf`) z warunków. */
export type ConditionExpr = Condition | { allOf: ConditionExpr[] } | { anyOf: ConditionExpr[] };
export const ConditionExprSchema: z.ZodType<ConditionExpr> = z.lazy(() =>
  z.union([ConditionSchema, z.object({ allOf: z.array(ConditionExprSchema) }), z.object({ anyOf: z.array(ConditionExprSchema) })]),
);

export const FieldValidationSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  /** Wyrażenie regularne jako string (bez ukośników). */
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
});
export type FieldValidation = z.infer<typeof FieldValidationSchema>;

export const PrefillSourceSchema = z.enum(["mObywatel", "CEIDG", "KRS"]);
export type PrefillSource = z.infer<typeof PrefillSourceSchema>;

export const FieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  required: z.boolean(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(OptionSchema).optional(),
  /** Id słownika z bazy COI (rozszerzenie opcjonalne I/II). */
  dictionaryId: z.string().optional(),
  validation: FieldValidationSchema.optional(),
  /** Skąd i pod jakim kluczem pobrać wartość z rejestrów (makieta). */
  prefill: z.object({ source: PrefillSourceSchema, key: z.string() }).optional(),
  visibleIf: ConditionSchema.optional(),
  /** Widoczność wynikająca z sekcji, w której jest pole; działa razem z `visibleIf`. */
  visibleWhen: ConditionExprSchema.optional(),
  legalBasis: LegalBasisSchema.optional(),
  defaultValue: z.string().optional(),
  readOnly: z.boolean().optional(),
  /** Pole blokuje się, gdy wskazane pole wyboru jest zaznaczone (np. „Brak nazwy ulicy”). */
  readOnlyIf: ConditionSchema.optional(),
});
export type Field = z.infer<typeof FieldSchema>;

export const FormPageSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  visibleIf: ConditionSchema.optional(),
  fields: z.array(FieldSchema),
});
export type FormPage = z.infer<typeof FormPageSchema>;

export const FormSchemaSchema = z.object({
  id: z.string(),
  version: z.number(),
  title: z.string(),
  issuer: z.string(),
  /** Nazwa pliku, z którego wygenerowano schemat. */
  sourceFile: z.string(),
  pages: z.array(FormPageSchema),
});
export type FormSchema = z.infer<typeof FormSchemaSchema>;

export const DraftStatusSchema = z.enum(["processing", "review", "published"]);
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

export const FormDraftSchema = z.object({
  id: z.string(),
  status: DraftStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
  schema: FormSchemaSchema,
});
export type FormDraft = z.infer<typeof FormDraftSchema>;

export const FormDraftSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  status: DraftStatusSchema,
  updatedAt: z.string(),
  sourceFile: z.string(),
  openErrors: z.number(),
  openWarnings: z.number(),
});
export type FormDraftSummary = z.infer<typeof FormDraftSummarySchema>;

export const PublishedFormSchema = z.object({
  id: z.string(),
  draftId: z.string(),
  version: z.number(),
  publishedAt: z.string(),
  publishedBy: z.string(),
  schema: FormSchemaSchema,
  /** Krótki opis usługi na liście obywatela. */
  summary: z.string(),
  estimatedMinutes: z.number(),
});
export type PublishedForm = z.infer<typeof PublishedFormSchema>;
