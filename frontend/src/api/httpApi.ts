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

const UploadStepSchema = z.enum(["upload", "parse", "ocr", "generate", "lint", "done"]);

/** Minimalny klient Server-Sent Events na fetch (obsługuje nagłówek Authorization). */
async function streamEvents(path: string, onEvent: (event: string, data: Record<string, unknown>) => void) {
  const headers = new Headers({ Accept: "text/event-stream" });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { headers });
  if (!res.ok || !res.body) throw new Error(`API ${res.status}: ${res.statusText}`);
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length) onEvent(event, JSON.parse(dataLines.join("\n")) as Record<string, unknown>);
    }
  }
}

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
    // Przetwarzanie w tle + etapy przez SSE (GET /drafts/{id}/events). fetch zamiast EventSource,
    // bo EventSource nie wysyła nagłówka Authorization.
    onProgress?.("upload");
    const body = new FormData();
    body.append("file", file);
    const { draftId } = await request(z.object({ draftId: z.string() }), "/drafts?async=true", {
      method: "POST",
      body,
    });
    await streamEvents(`/drafts/${draftId}/events`, (event, data) => {
      if (event === "error") throw new Error(String(data.error ?? "Nie udało się przetworzyć pliku."));
      const step = UploadStepSchema.safeParse(data.step);
      if (step.success) onProgress?.(step.data);
    });
    return { draftId };
  },

  getDraft: (id) => request(DraftSchema, `/drafts/${id}`),
  getDraftCoi: (id) => request(z.unknown(), `/drafts/${id}/coi`),

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
