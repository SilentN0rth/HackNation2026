import { z } from "zod";

/** Pięć linterów z architektury (Panel Lintera). */
export const LinterIdSchema = z.enum([
  "exact-match", // czy cytat istnieje w ustawie (kod, bez LLM)
  "citation-relevance", // czy cytat uzasadnia pole (LLM)
  "gdpr", // minimalizacja danych (LLM)
  "static-graph", // martwe ścieżki, złe odwołania (kod, bez LLM)
  "wcag", // dostępność i prosty język
]);
export type LinterId = z.infer<typeof LinterIdSchema>;

export const SeveritySchema = z.enum(["error", "warning", "info"]);
export type Severity = z.infer<typeof SeveritySchema>;

export const FlagResolutionSchema = z.object({
  action: z.enum(["fixed", "rejected"]),
  /** Wymagane przy „rejected” – trafia do Audit Trail. */
  justification: z.string().optional(),
  by: z.string(),
  at: z.string(),
});
export type FlagResolution = z.infer<typeof FlagResolutionSchema>;

export const LintFlagSchema = z.object({
  /** Deterministyczne id, np. „exact-match:lokal_liczba_pokoi”, żeby rozstrzygnięcie przetrwało ponowne uruchomienie linterów. */
  id: z.string(),
  linter: LinterIdSchema,
  severity: SeveritySchema,
  pageId: z.string().optional(),
  fieldId: z.string().optional(),
  title: z.string(),
  message: z.string(),
  /** Np. fragment ustawy albo cytat, którego nie znaleziono. */
  evidence: z.string().optional(),
  suggestion: z.string().optional(),
  resolution: FlagResolutionSchema.optional(),
});
export type LintFlag = z.infer<typeof LintFlagSchema>;

export const LINTER_LABELS: Record<LinterId, string> = {
  "exact-match": "Cytat w ustawie",
  "citation-relevance": "Trafność cytatu",
  gdpr: "RODO – minimalizacja",
  "static-graph": "Logika formularza",
  wcag: "Dostępność i prosty język",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  error: "Krytyczne",
  warning: "Ostrzeżenie",
  info: "Sugestia",
};
