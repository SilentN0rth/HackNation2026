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

export interface Api {
  getCurrentUser(role: User["role"]): Promise<User>;
  listDrafts(): Promise<FormDraftSummary[]>;
  uploadDocument(file: File, onProgress?: (step: UploadStep) => void): Promise<{ draftId: string }>;
  getDraft(draftId: string): Promise<FormDraft>;
  getCoiJson(draftId: string): Promise<unknown>;
  updateDraftSchema(draftId: string, schema: FormSchema): Promise<FormDraft>;
  getStatuteChunks(draftId: string): Promise<StatuteChunk[]>;
  runLinters(draftId: string): Promise<LintFlag[]>;
  resolveFlag(draftId: string, flagId: string, resolution: Omit<FlagResolution, "by" | "at">): Promise<LintFlag>;
  publishDraft(draftId: string): Promise<PublishedForm>;
  getAuditTrail(draftId?: string): Promise<AuditEntry[]>;
  listPublishedForms(): Promise<PublishedForm[]>;
  getPublishedForm(formId: string): Promise<PublishedForm>;
  getPrefill(formId: string): Promise<PrefillData>;
  listMyApplications(): Promise<Application[]>;
  getApplication(applicationId: string): Promise<Application>;
  /** Wysyła załącznik; zwraca wartość pola w formacie „id|nazwa”. Brak metody = zapis samej nazwy pliku. */
  uploadAttachment?(file: File): Promise<string>;
  saveApplication(app: Omit<Application, "id" | "updatedAt"> & { id?: string }): Promise<Application>;
}

export type UploadStep = "upload" | "parse" | "ocr" | "generate" | "lint" | "done";

export const UPLOAD_STEP_LABELS: Record<UploadStep, string> = {
  upload: "Sprawdzenie pliku",
  parse: "Odczyt dokumentu",
  ocr: "Rozpoznawanie tekstu (OCR)",
  generate: "Budowa formularza",
  lint: "Kontrola jakości",
  done: "Gotowe",
};
