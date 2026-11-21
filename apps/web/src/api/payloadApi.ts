import { z } from "zod";
import { countOpen } from "../lib/lint";
import type { Api, UploadStep } from "./types";
import {
  ApplicationSchema,
  AuditEntrySchema,
  FormDraftSchema,
  FormSchemaSchema,
  LintFlagSchema,
  PrefillDataSchema,
  PublishedFormSchema,
  type Application,
  type AuditEntry,
  type FormDraft,
  type FormDraftSummary,
  type FormSchema,
  type LintFlag,
  type PublishedForm,
  type User,
} from "../types";

/**
 * Api na REST Payloada (/api/payload). Obywatel czyta opublikowane formularze i zapisuje wnioski bez logowania;
 * metody urzędnika korzystają z ciasteczka sesji panelu (/official).
 */
const BASE = "/api/payload";

/** Obywatel nie loguje się do Payloada – konto demonstracyjne (makieta węzła krajowego). */
const DEMO_CITIZEN: User = { id: "u-citizen", name: "Jan Kowalski", role: "citizen", initials: "JK" };

const ErrorsSchema = z.object({ errors: z.array(z.object({ message: z.string() })) }).partial();
const ListSchema = z.object({ docs: z.array(z.unknown()) });

type Query = Record<string, string | number | boolean | undefined>;

async function call(path: string, init: RequestInit = {}, query: Query = {}): Promise<unknown> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  const qs = params.size ? `?${params}` : "";
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new Error("Brak połączenia z serwerem. Spróbuj ponownie.");
  }
  if (!res.ok) {
    const problem = ErrorsSchema.safeParse(await res.json().catch(() => ({})));
    const message = problem.success ? problem.data.errors?.[0]?.message : undefined;
    throw new Error(message ?? `Błąd serwera (${res.status}).`);
  }
  return res.status === 204 ? undefined : res.json();
}

async function list(path: string, query: Query = {}): Promise<Doc[]> {
  return ListSchema.parse(await call(path, {}, { limit: 100, depth: 0, ...query })).docs as Doc[];
}

const json = (body: unknown) => JSON.stringify(body);
const docOf = (body: unknown) => ((body as { doc?: Doc }).doc ?? body) as Doc;
const relId = (value: unknown) => String(typeof value === "object" && value !== null ? (value as { id: unknown }).id : (value ?? ""));

/** Dokument Payloada po stronie klienta – kształt sprawdza Zod przy mapowaniu. */
type Doc = Record<string, unknown> & { id: number | string };

function parse<S extends z.ZodType>(schema: S, value: unknown, what: string): z.infer<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new Error(`${what}: niezgodny kontrakt – ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

const flagsOf = (doc: Doc): LintFlag[] => parse(z.array(LintFlagSchema), doc.lintFlags ?? [], "Uwagi");

function schemaOf(doc: Doc): FormSchema {
  if (doc.schema) return parse(FormSchemaSchema, doc.schema, `Formularz ${doc.id}`);
  const title = String(doc.title ?? "Nowy formularz");
  return { id: String(doc.slug ?? doc.id), version: Number(doc.version ?? 0), title, issuer: "", sourceFile: "", pages: [] };
}

function draftStatus(doc: Doc, schema: FormSchema): FormDraft["status"] {
  if (doc.status === "published") return "published";
  return schema.pages.length ? "review" : "processing";
}

function toDraft(doc: Doc): FormDraft {
  const schema = schemaOf(doc);
  return parse(
    FormDraftSchema,
    {
      id: String(doc.id),
      status: draftStatus(doc, schema),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      createdBy: relId(doc.publishedBy),
      schema,
    },
    "Wersja robocza",
  );
}

function toSummary(doc: Doc): FormDraftSummary {
  const schema = schemaOf(doc);
  const open = countOpen(flagsOf(doc));
  return {
    id: String(doc.id),
    title: String(doc.title ?? schema.title),
    status: draftStatus(doc, schema),
    updatedAt: String(doc.updatedAt),
    sourceFile: schema.sourceFile,
    openErrors: open.errors,
    openWarnings: open.warnings,
  };
}

function toPublished(doc: Doc): PublishedForm {
  const schema = schemaOf(doc);
  return parse(
    PublishedFormSchema,
    {
      id: String(doc.id),
      draftId: String(doc.id),
      version: Number(doc.version ?? schema.version),
      publishedAt: doc.publishedAt ?? doc.updatedAt,
      publishedBy: doc.publishedByName ?? "",
      schema,
      summary: doc.summary ?? "",
      estimatedMinutes: Number(doc.estimatedMinutes ?? 5),
    },
    "Formularz",
  );
}

function toApplication(doc: Doc): Application {
  return parse(
    ApplicationSchema,
    {
      id: String(doc.id),
      formId: relId(doc.form),
      formTitle: doc.formTitle ?? "",
      status: doc.status,
      updatedAt: doc.updatedAt,
      values: doc.values ?? {},
      confirmationNo: doc.confirmationNo ?? undefined,
    },
    "Wniosek",
  );
}

function toAudit(doc: Doc): AuditEntry {
  return parse(
    AuditEntrySchema,
    {
      id: String(doc.id),
      draftId: relId(doc.form),
      at: doc.createdAt,
      userId: doc.user ? relId(doc.user) : "system",
      userName: doc.actorName ?? "System",
      action: doc.action,
      details: doc.details,
      aiOutputRef: doc.aiOutputRef ?? undefined,
    },
    "Dziennik",
  );
}

const getForm = async (id: string, draft = true) => docOf(await call(`/forms/${id}`, {}, { depth: 0, draft }));
const patchForm = async (id: string, data: Record<string, unknown>, draft = true) =>
  docOf(await call(`/forms/${id}`, { method: "PATCH", body: json(data) }, { depth: 0, draft }));

const STEPS: UploadStep[] = ["upload", "parse", "ocr", "generate", "lint"];

export const payloadApi: Api = {
  async getCurrentUser(role) {
    if (role === "citizen") return DEMO_CITIZEN;
    const body = (await call("/users/me").catch(() => null)) as { user?: Doc | null } | null;
    const user = body?.user;
    if (!user) return { id: "", name: "", role: "official", initials: "" };
    return { id: String(user.id), name: String(user.name ?? ""), role: "official", initials: String(user.initials ?? "") };
  },

  listDrafts: async () => (await list("/forms", { draft: true, sort: "-updatedAt" })).map(toSummary),

  async uploadDocument(file, onProgress) {
    let step = 0;
    onProgress?.(STEPS[0]);
    const timer = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 1);
      onProgress?.(STEPS[step]);
    }, 450);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("_payload", json({ alt: file.name }));
      const media = docOf(await call("/media", { method: "POST", body }));
      const form = docOf(await call("/forms", { method: "POST", body: json({ source: media.id }) }, { draft: true, depth: 0 }));
      // Formularz zapisuje się także przy awarii silnika AI – wtedy zgłaszamy błąd, a panel pozwala ponowić.
      if (form.aiStatus === "error") throw new Error(String(form.aiError ?? "Silnik AI niedostępny."));
      onProgress?.("done");
      return { draftId: String(form.id) };
    } finally {
      clearInterval(timer);
    }
  },

  getDraft: async (id) => toDraft(await getForm(id)),
  getCoiJson: async (id) => (await getForm(id)).coiJson ?? null,

  updateDraftSchema: async (id, schema) => toDraft(await patchForm(id, { schema, title: schema.title })),

  getStatuteChunks: async () =>
    (await list("/statute-chunks", { limit: 500 })).map((d) => ({
      id: String(d.chunkId),
      act: String(d.act),
      unit: String(d.unit),
      text: String(d.text),
    })),

  runLinters: async (id) => flagsOf(docOf(await call(`/forms/${id}/lint`, { method: "POST" }))),

  async resolveFlag(id, flagId, resolution) {
    const [doc, me] = await Promise.all([getForm(id), payloadApi.getCurrentUser("official")]);
    let resolved: LintFlag | undefined;
    const flags = flagsOf(doc).map((f) => {
      if (f.id !== flagId) return f;
      resolved = { ...f, resolution: { ...resolution, by: me.name, at: new Date().toISOString() } };
      return resolved;
    });
    if (!resolved) throw new Error(`Nie znaleziono uwagi ${flagId}`);
    await patchForm(id, { lintFlags: flags });
    return resolved;
  },

  publishDraft: async (id) => toPublished(await patchForm(id, { status: "published", _status: "published" }, false)),

  getAuditTrail: async (draftId) =>
    (await list("/audit-log", { sort: "-createdAt", limit: 500, ...(draftId ? { "where[form][equals]": draftId } : {}) })).map(toAudit),

  listPublishedForms: async () =>
    (await list("/forms", { "where[status][equals]": "published", sort: "-publishedAt" })).map(toPublished),

  async getPublishedForm(id) {
    const doc = await getForm(id, false);
    if (doc.status !== "published") throw new Error(`Nie znaleziono formularza ${id}`);
    return toPublished(doc);
  },

  getPrefill: async (formId) => parse(PrefillDataSchema, await call("/prefill", {}, { formId }), "Prefill"),

  listMyApplications: async () => (await list("/applications", { sort: "-updatedAt" })).map(toApplication),

  getApplication: async (id) => toApplication(docOf(await call(`/applications/${id}`, {}, { depth: 0 }))),

  async saveApplication(app) {
    const data = {
      form: Number(app.formId),
      formTitle: app.formTitle,
      status: app.status,
      values: app.values,
      ...(app.confirmationNo ? { confirmationNo: app.confirmationNo } : {}),
    };
    const body = app.id
      ? await call(`/applications/${app.id}`, { method: "PATCH", body: json(data) }, { depth: 0 })
      : await call("/applications", { method: "POST", body: json(data) }, { depth: 0 });
    return toApplication(docOf(body));
  },
};
