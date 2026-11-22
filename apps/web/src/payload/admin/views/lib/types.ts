import type { AuditAction, FormSchema, LintFlag } from "@/types";

export type FormStatus = "draft" | "in_review" | "published";
export type AiStatus = "idle" | "ready" | "error";

export type FormDoc = {
  id: number;
  title: string;
  status: FormStatus;
  aiStatus: AiStatus;
  aiError: string | null;
  fastapiDraftId: string | null;
  schema: FormSchema | null;
  lintFlags: LintFlag[];
  version: number;
  updatedAt: string;
  sourceName: string | null;
};

export type AuditItem = {
  id: number;
  at: string;
  action: AuditAction;
  actor: string;
  details: string;
  aiOutputRef: string | null;
  formId: number | null;
  formTitle: string | null;
};

export const FORM_STATUS_LABELS: Record<FormStatus, string> = {
  draft: "Wersja robocza",
  in_review: "Do weryfikacji",
  published: "Opublikowany",
};

export const AUDIT_LABELS: Record<AuditAction, string> = {
  upload: "Wgranie pliku",
  draft_generated: "Wygenerowanie formularza",
  linters_run: "Kontrola jakości",
  field_edited: "Edycja",
  flag_fixed: "Poprawienie uwagi",
  flag_rejected: "Odrzucenie uwagi",
  published: "Publikacja",
};
