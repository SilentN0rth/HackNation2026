import { z } from "zod";

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

export const LegalBasisSchema = z.object({
  act: z.string(),
  unit: z.string(),
  quote: z.string(),
  chunkId: z.string().optional(),
});
export type LegalBasis = z.infer<typeof LegalBasisSchema>;

export const ConditionSchema = z.object({
  fieldId: z.string(),
  equals: z.union([z.string(), z.boolean()]),
  negate: z.boolean().optional(),
});
export type Condition = z.infer<typeof ConditionSchema>;

export type ConditionExpr = Condition | { allOf: ConditionExpr[] } | { anyOf: ConditionExpr[] };
export const ConditionExprSchema: z.ZodType<ConditionExpr> = z.lazy(() =>
  z.union([ConditionSchema, z.object({ allOf: z.array(ConditionExprSchema) }), z.object({ anyOf: z.array(ConditionExprSchema) })]),
);

export const FieldValidationSchema = z.object({
  minLength: z.number().optional(),
  maxLength: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  pattern: z.string().optional(),
  patternMessage: z.string().optional(),
});
export type FieldValidation = z.infer<typeof FieldValidationSchema>;

export const PrefillSourceSchema = z.enum(["PESEL", "PESEL_ADDRESS", "MLPZ"]);
export type PrefillSource = z.infer<typeof PrefillSourceSchema>;

export const FieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: FieldTypeSchema,
  required: z.boolean(),
  /** Tytuł sekcji tematycznej, w której pole stoi (np. „Podmiot wniosku”); sąsiednie pola z tym samym tytułem tworzą sekcję. */
  section: z.string().optional(),
  helpText: z.string().optional(),
  placeholder: z.string().optional(),
  options: z.array(OptionSchema).optional(),
  dictionaryId: z.string().optional(),
  validation: FieldValidationSchema.optional(),
  prefill: z.object({ source: PrefillSourceSchema, key: z.string() }).optional(),
  visibleIf: ConditionSchema.optional(),
  visibleWhen: ConditionExprSchema.optional(),
  legalBasis: LegalBasisSchema.optional(),
  defaultValue: z.string().optional(),
  readOnly: z.boolean().optional(),
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
  summary: z.string(),
  estimatedMinutes: z.number(),
});
export type PublishedForm = z.infer<typeof PublishedFormSchema>;
