import { z } from "zod";
import type { Api } from "./types";
import { fromCoiJson, toCoiJson } from "./adapters";
import {
  ApplicationSchema,
  AuditEntrySchema,
  FormDraftSchema,
  FormDraftSummarySchema,
  LintFlagSchema,
  PrefillDataSchema,
  PublishedFormSchema,
  StatuteChunkSchema,
  UserSchema,
} from "../types";

/**
 * Prawdziwe API (FastAPI). Włączane przez NEXT_PUBLIC_USE_MOCKS=false w pliku .env.local.
 *
 * Ścieżki endpointów to PROPOZYCJA – uzgodnijcie je z backendem i poprawcie tylko tutaj.
 * Każda odpowiedź przechodzi przez schemat Zod z src/types – jeśli backend zwróci
 * inny kształt, od razu zobaczycie czytelny błąd zamiast „undefined is not a function”.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

let token: string | null = null;
export const setToken = (t: string | null) => {
  token = t;
};

async function request<S extends z.ZodType>(schema: S, path: string, init: RequestInit = {}): Promise<z.infer<S>> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  const body: unknown = res.status === 204 ? undefined : await res.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error(`API ${path}: niezgodny kontrakt – ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

const json = (body: unknown) => JSON.stringify(body);

/** Wersja robocza z backendu: schemat może przyjść w formacie COI, więc najpierw adapter, potem Zod. */
const RawDraftSchema = FormDraftSchema.extend({ schema: z.unknown() }).transform((d) => ({
  ...d,
  schema: fromCoiJson(d.schema),
}));
const DraftSchema = RawDraftSchema.pipe(FormDraftSchema);

export const httpApi: Api = {
  getCurrentUser: (role) => request(UserSchema, `/me?role=${role}`),

  listDrafts: () => request(z.array(FormDraftSummarySchema), "/drafts"),

  async uploadDocument(file, onProgress) {
    // Prosta wersja: jedno żądanie. Jeśli backend będzie raportował postęp (SSE/WebSocket),
    // wołajcie onProgress przy każdym zdarzeniu.
    onProgress?.("upload");
    const body = new FormData();
    body.append("file", file);
    const res = await request(z.object({ draftId: z.string() }), "/drafts", { method: "POST", body });
    onProgress?.("done");
    return res;
  },

  getDraft: (id) => request(DraftSchema, `/drafts/${id}`),

  updateDraftSchema: (id, schema) =>
    request(DraftSchema, `/drafts/${id}`, { method: "PUT", body: json({ schema: toCoiJson(schema) }) }),

  getStatuteChunks: (id) => request(z.array(StatuteChunkSchema), `/drafts/${id}/statute-chunks`),
  runLinters: (id) => request(z.array(LintFlagSchema), `/drafts/${id}/lint`, { method: "POST" }),
  resolveFlag: (id, flagId, resolution) =>
    request(LintFlagSchema, `/drafts/${id}/flags/${encodeURIComponent(flagId)}`, {
      method: "PATCH",
      body: json(resolution),
    }),
  publishDraft: (id) => request(PublishedFormSchema, `/drafts/${id}/publish`, { method: "POST" }),
  getAuditTrail: (draftId) =>
    request(z.array(AuditEntrySchema), draftId ? `/audit?draftId=${draftId}` : "/audit"),

  listPublishedForms: () => request(z.array(PublishedFormSchema), "/forms"),
  getPublishedForm: (id) => request(PublishedFormSchema, `/forms/${id}`),
  getPrefill: (formId) => request(PrefillDataSchema, `/prefill?formId=${formId}`),
  listMyApplications: () => request(z.array(ApplicationSchema), "/applications?mine=true"),
  getApplication: (id) => request(ApplicationSchema, `/applications/${id}`),
  saveApplication: (app) =>
    app.id
      ? request(ApplicationSchema, `/applications/${app.id}`, { method: "PUT", body: json(app) })
      : request(ApplicationSchema, "/applications", { method: "POST", body: json(app) }),
};
