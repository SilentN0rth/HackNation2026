import { z } from "zod";

export const RoleSchema = z.enum(["official", "citizen"]);
export type Role = z.infer<typeof RoleSchema>;

export const UserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: RoleSchema,
  /** Inicjały do Audit Trail. */
  initials: z.string(),
});
export type User = z.infer<typeof UserSchema>;

export const AuditActionSchema = z.enum([
  "upload",
  "draft_generated",
  "linters_run",
  "field_edited",
  "flag_fixed",
  "flag_rejected",
  "published",
]);
export type AuditAction = z.infer<typeof AuditActionSchema>;

export const AuditEntrySchema = z.object({
  id: z.string(),
  draftId: z.string(),
  at: z.string(),
  userId: z.string(),
  userName: z.string(),
  action: AuditActionSchema,
  /** Czytelny opis, np. „Odrzucono flagę RODO dla pola PESEL”. */
  details: z.string(),
  /** Wersja modelu / promptu, na podstawie której zapadła decyzja. */
  aiOutputRef: z.string().optional(),
});
export type AuditEntry = z.infer<typeof AuditEntrySchema>;

export const ApplicationStatusSchema = z.enum(["draft", "sent", "accepted"]);
export type ApplicationStatus = z.infer<typeof ApplicationStatusSchema>;

export const ApplicationSchema = z.object({
  id: z.string(),
  formId: z.string(),
  formTitle: z.string(),
  status: ApplicationStatusSchema,
  updatedAt: z.string(),
  /** Wartości pól: fieldId -> wartość. */
  values: z.record(z.string(), z.union([z.string(), z.boolean()])),
  /** Numer potwierdzenia (UPO – makieta). */
  confirmationNo: z.string().optional(),
});
export type Application = z.infer<typeof ApplicationSchema>;

/** Dane z rejestrów do prefillu (makieta mObywatel / CEIDG). */
export const PrefillDataSchema = z.record(z.string(), z.string());
export type PrefillData = z.infer<typeof PrefillDataSchema>;

/** Fragment ustawy po chunkowaniu (jednostka redakcyjna). */
export const StatuteChunkSchema = z.object({
  id: z.string(),
  act: z.string(),
  unit: z.string(),
  text: z.string(),
});
export type StatuteChunk = z.infer<typeof StatuteChunkSchema>;
