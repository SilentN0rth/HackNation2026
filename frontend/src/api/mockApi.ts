import type { Api, UploadStep } from "./types";
import type { Application, AuditEntry, FormDraft, LintFlag, PublishedForm } from "../types";
import * as mocks from "../mocks";
import { canPublish, countOpen } from "../lib/lint";

/**
 * Implementacja API na danych z src/mocks.
 * Stan trzymamy w pamięci (kopia mocków) – odświeżenie strony resetuje demo.
 */

const clone = <T,>(v: T): T => structuredClone(v);
const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

const state = {
  drafts: clone(mocks.drafts),
  flags: new Map<string, LintFlag[]>(),
  published: clone(mocks.publishedForms),
  applications: clone(mocks.applications),
  audit: clone(mocks.auditTrail),
};

const official = mocks.users.official;

function findDraft(id: string): FormDraft {
  const d = state.drafts.find((x) => x.id === id);
  if (!d) throw new Error(`Nie znaleziono wersji roboczej ${id}`);
  return d;
}

function lint(draftId: string): LintFlag[] {
  const draft = findDraft(draftId);
  const flags = runLint(draft);
  state.flags.set(draftId, flags);
  return flags;
}

function runLint(draft: FormDraft): LintFlag[] {
  if (draft.status === "processing") return [];
  return mocks.runMockLinters(draft.schema, mocks.statuteChunks, state.flags.get(draft.id) ?? []);
}

function log(entry: Omit<AuditEntry, "id" | "at" | "userId" | "userName">) {
  state.audit.push({ id: uid("a"), at: now(), userId: official.id, userName: official.name, ...entry });
}

export const mockApi: Api = {
  async getCurrentUser(role) {
    await wait(50);
    return clone(mocks.users[role]);
  },

  async listDrafts() {
    await wait();
    return state.drafts.map((d) => {
      const open = countOpen(state.flags.get(d.id) ?? runLint(d));
      return {
        id: d.id,
        title: d.schema.title,
        status: d.status,
        updatedAt: d.updatedAt,
        sourceFile: d.schema.sourceFile,
        openErrors: open.errors,
        openWarnings: open.warnings,
      };
    });
  },

  async uploadDocument(file, onProgress) {
    const steps: UploadStep[] = ["upload", "parse", "ocr", "generate", "lint"];
    for (const s of steps) {
      onProgress?.(s);
      await wait(s === "generate" ? 1200 : 500);
    }
    // Każdy wgrany plik „daje” ten sam przykładowy formularz – podmieńcie na backend.
    const template = clone(mocks.drafts[0]);
    const draft: FormDraft = {
      ...template,
      id: uid("draft"),
      createdAt: now(),
      updatedAt: now(),
      schema: { ...template.schema, sourceFile: file.name },
    };
    state.drafts.unshift(draft);
    log({ draftId: draft.id, action: "upload", details: `Wgrano plik ${file.name}.` });
    log({ draftId: draft.id, action: "draft_generated", details: "Wygenerowano wersję roboczą.", aiOutputRef: "mock" });
    lint(draft.id);
    onProgress?.("done");
    return { draftId: draft.id };
  },

  async getDraft(draftId) {
    await wait();
    return clone(findDraft(draftId));
  },

  async updateDraftSchema(draftId, schema) {
    await wait(150);
    const d = findDraft(draftId);
    d.schema = clone(schema);
    d.updatedAt = now();
    log({ draftId, action: "field_edited", details: "Zmieniono strukturę formularza w edytorze." });
    return clone(d);
  },

  async getStatuteChunks() {
    await wait(100);
    return clone(mocks.statuteChunks);
  },

  async runLinters(draftId) {
    await wait(400);
    const flags = lint(draftId);
    log({ draftId, action: "linters_run", details: `Uruchomiono lintery: ${flags.length} flag.` });
    return clone(flags);
  },

  async resolveFlag(draftId, flagId, resolution) {
    await wait(150);
    const flags = state.flags.get(draftId) ?? lint(draftId);
    const flag = flags.find((f) => f.id === flagId);
    if (!flag) throw new Error(`Nie znaleziono flagi ${flagId}`);
    flag.resolution = { ...resolution, by: official.name, at: now() };
    log({
      draftId,
      action: resolution.action === "fixed" ? "flag_fixed" : "flag_rejected",
      details:
        resolution.action === "fixed"
          ? `Oznaczono jako poprawione: ${flag.title}`
          : `Odrzucono flagę: ${flag.title}. Uzasadnienie: ${resolution.justification ?? "—"}`,
      aiOutputRef: flag.linter,
    });
    return clone(flag);
  },

  async publishDraft(draftId) {
    await wait(400);
    const d = findDraft(draftId);
    const flags = state.flags.get(draftId) ?? lint(draftId);
    if (!canPublish(flags)) throw new Error("Nie wszystkie krytyczne flagi zostały obsłużone.");
    d.status = "published";
    d.schema.version += 1;
    d.updatedAt = now();
    const form: PublishedForm = {
      id: `form-${d.schema.id}-v${d.schema.version}`,
      draftId,
      version: d.schema.version,
      publishedAt: now(),
      publishedBy: official.name,
      schema: clone(d.schema),
      summary: "Sprawdź, czy przysługuje Ci dopłata do czynszu, i złóż wniosek online.",
      estimatedMinutes: 8,
    };
    state.published.unshift(form);
    log({ draftId, action: "published", details: `Opublikowano wersję ${d.schema.version}.` });
    return clone(form);
  },

  async getAuditTrail(draftId) {
    await wait();
    const list = draftId ? state.audit.filter((a) => a.draftId === draftId) : state.audit;
    return clone([...list].reverse());
  },

  async listPublishedForms() {
    await wait();
    return clone(state.published);
  },

  async getPublishedForm(formId) {
    await wait();
    const f = state.published.find((x) => x.id === formId);
    if (!f) throw new Error(`Nie znaleziono formularza ${formId}`);
    return clone(f);
  },

  async getPrefill() {
    await wait(300);
    return clone(mocks.prefillData);
  },

  async listMyApplications() {
    await wait();
    return clone(state.applications);
  },

  async getApplication(applicationId) {
    await wait();
    const a = state.applications.find((x) => x.id === applicationId);
    if (!a) throw new Error(`Nie znaleziono wniosku ${applicationId}`);
    return clone(a);
  },

  async saveApplication(input) {
    await wait(300);
    const existing = input.id ? state.applications.find((a) => a.id === input.id) : undefined;
    const app: Application = {
      ...input,
      id: existing?.id ?? uid("app"),
      updatedAt: now(),
      confirmationNo:
        input.status === "sent" ? `UPO/2026/11/${String(Math.floor(Math.random() * 1e6)).padStart(6, "0")}` : input.confirmationNo,
    };
    if (existing) Object.assign(existing, app);
    else state.applications.unshift(app);
    return clone(app);
  },
};
