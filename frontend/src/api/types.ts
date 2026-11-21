import type {
  Application,
  AuditEntry,
  FlagResolution,
  FormDraft,
  FormDraftSummary,
  FormSchema,
  LintFlag,
  PrefillData,
  PublishedForm,
  StatuteChunk,
  User,
} from "../types";

/**
 * KONTRAKT frontend ↔ backend.
 * mockApi.ts i httpApi.ts implementują dokładnie ten interfejs, więc komponenty
 * nie wiedzą, z którego korzystają. Zmieniacie kontrakt? Zmieńcie go TU i w obu plikach.
 */
export interface Api {
  // --- sesja ---
  getCurrentUser(role: User["role"]): Promise<User>;

  // --- urzędnik ---
  listDrafts(): Promise<FormDraftSummary[]>;
  /** Wysyła plik, backend parsuje, robi OCR i generuje schemat. Zwraca id wersji roboczej. */
  uploadDocument(file: File, onProgress?: (step: UploadStep) => void): Promise<{ draftId: string }>;
  getDraft(draftId: string): Promise<FormDraft>;
  updateDraftSchema(draftId: string, schema: FormSchema): Promise<FormDraft>;
  getStatuteChunks(draftId: string): Promise<StatuteChunk[]>;
  runLinters(draftId: string): Promise<LintFlag[]>;
  resolveFlag(draftId: string, flagId: string, resolution: Omit<FlagResolution, "by" | "at">): Promise<LintFlag>;
  publishDraft(draftId: string): Promise<PublishedForm>;
  getAuditTrail(draftId?: string): Promise<AuditEntry[]>;

  // --- obywatel ---
  listPublishedForms(): Promise<PublishedForm[]>;
  getPublishedForm(formId: string): Promise<PublishedForm>;
  getPrefill(formId: string): Promise<PrefillData>;
  listMyApplications(): Promise<Application[]>;
  getApplication(applicationId: string): Promise<Application>;
  saveApplication(app: Omit<Application, "id" | "updatedAt"> & { id?: string }): Promise<Application>;
}

/** Etapy przetwarzania pokazywane na ekranie wgrywania. */
export type UploadStep = "upload" | "parse" | "ocr" | "generate" | "lint" | "done";

export const UPLOAD_STEP_LABELS: Record<UploadStep, string> = {
  upload: "Wysyłanie pliku",
  parse: "Odczyt struktury dokumentu",
  ocr: "Rozpoznawanie tekstu (OCR)",
  generate: "Generowanie formularza z podstawą prawną",
  lint: "Kontrola jakości (5 linterów)",
  done: "Gotowe",
};
