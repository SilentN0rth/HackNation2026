import { z } from "zod";
import type { Api, UploadStep } from "./types";
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
  type Role,
} from "../types";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const USER_BY_ROLE: Record<Role, string> = { official: "u-urzednik", citizen: "u-obywatel" };
const TokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });
const ProblemSchema = z.object({ detail: z.string() }).partial();

const tokens = new Map<Role, { value: string; expires: number }>();

async function token(role: Role): Promise<string> {
  const cached = tokens.get(role);
  if (cached && cached.expires > Date.now() + 30_000) return cached.value;
  const res = await fetch(`${BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: USER_BY_ROLE[role] }),
  });
  if (!res.ok) throw new Error("Nie udało się zalogować do API.");
  const body = TokenSchema.parse(await res.json());
  tokens.set(role, { value: body.access_token, expires: Date.now() + body.expires_in * 1000 });
  return body.access_token;
}

async function call(path: string, init: RequestInit = {}, role: Role = "official"): Promise<unknown> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await token(role)}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new Error("Brak połączenia z API. Sprawdź, czy backend działa.");
  }
  if (res.status === 401) tokens.delete(role);
  if (!res.ok) {
    const problem = ProblemSchema.safeParse(await res.json().catch(() => ({})));
    throw new Error(problem.success && problem.data.detail ? problem.data.detail : `Błąd API (${res.status}).`);
  }
  return res.status === 204 ? undefined : res.json();
}

async function request<S extends z.ZodType>(schema: S, path: string, init: RequestInit = {}, role: Role = "official"): Promise<z.infer<S>> {
  const body = await call(path, init, role);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error(`API ${path}: niezgodny kontrakt – ${z.prettifyError(parsed.error)}`);
  return parsed.data;
}

const json = (body: unknown) => JSON.stringify(body);
const STEPS: UploadStep[] = ["upload", "parse", "ocr", "generate", "lint"];

export const httpApi: Api = {
  getCurrentUser: (role) => request(UserSchema, `/me?role=${role}`, {}, role),

  listDrafts: () => request(z.array(FormDraftSummarySchema), "/drafts"),

  async uploadDocument(file, onProgress) {
    const body = new FormData();
    body.append("file", file);
    let step = 0;
    onProgress?.(STEPS[0]);
    const timer = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 1);
      onProgress?.(STEPS[step]);
    }, 450);
    try {
      const res = await request(z.object({ draftId: z.string() }), "/drafts", { method: "POST", body });
      onProgress?.("done");
      return res;
    } finally {
      clearInterval(timer);
    }
  },

  getDraft: (id) => request(FormDraftSchema, `/drafts/${id}`),
  getCoiJson: (id) => call(`/drafts/${id}/coi`),

  updateDraftSchema: (id, schema) => request(FormDraftSchema, `/drafts/${id}`, { method: "PUT", body: json({ schema }) }),

  getStatuteChunks: (id) => request(z.array(StatuteChunkSchema), `/drafts/${id}/statute-chunks`),
  runLinters: (id) => request(z.array(LintFlagSchema), `/drafts/${id}/lint`, { method: "POST" }),
  resolveFlag: (id, flagId, resolution) =>
    request(LintFlagSchema, `/drafts/${id}/flags/${encodeURIComponent(flagId)}`, {
      method: "PATCH",
      body: json(resolution),
    }),
  publishDraft: (id) => request(PublishedFormSchema, `/drafts/${id}/publish`, { method: "POST" }),
  getAuditTrail: (draftId) => request(z.array(AuditEntrySchema), draftId ? `/audit?draftId=${draftId}` : "/audit"),

  listPublishedForms: () => request(z.array(PublishedFormSchema), "/forms", {}, "citizen"),
  getPublishedForm: (id) => request(PublishedFormSchema, `/forms/${id}`, {}, "citizen"),
  getPrefill: (formId) => request(PrefillDataSchema, `/prefill?formId=${formId}`, {}, "citizen"),
  listMyApplications: () => request(z.array(ApplicationSchema), "/applications?mine=true", {}, "citizen"),
  getApplication: (id) => request(ApplicationSchema, `/applications/${id}`, {}, "citizen"),
  async uploadAttachment(file) {
    const form = new FormData();
    form.append("file", file);
    const body = z.object({ id: z.string(), name: z.string() }).parse(await call("/attachments", { method: "POST", body: form }, "citizen"));
    return `${body.id}|${body.name}`;
  },
  saveApplication: (app) =>
    app.id
      ? request(ApplicationSchema, `/applications/${app.id}`, { method: "PUT", body: json(app) }, "citizen")
      : request(ApplicationSchema, "/applications", { method: "POST", body: json(app) }, "citizen"),
};
