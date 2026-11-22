import { z } from "zod";
import { FormDraftSchema, LintFlagSchema, type FormSchema, type LintFlag } from "../../types";

export const FASTAPI_URL = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");

const ACCOUNTS = { official: "u-urzednik" } as const;
type Account = keyof typeof ACCOUNTS;

const TokenSchema = z.object({ access_token: z.string(), expires_in: z.number() });
const ProblemSchema = z.object({ detail: z.string() }).partial();

export class FastApiError extends Error {
  constructor(
    message: string,
    readonly unavailable = false,
  ) {
    super(message);
    this.name = "FastApiError";
  }
}

const tokens = new Map<Account, { value: string; expires: number }>();

async function send(path: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  try {
    return await fetch(`${FASTAPI_URL}${path}`, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timeout = e instanceof Error && e.name === "TimeoutError";
    throw new FastApiError(
      timeout
        ? "Silnik AI nie odpowiedział w wyznaczonym czasie. Spróbuj ponownie."
        : `Silnik AI (FastAPI) jest niedostępny pod ${FASTAPI_URL}. Uruchom go i spróbuj ponownie.`,
      true,
    );
  }
}

async function token(account: Account): Promise<string> {
  const cached = tokens.get(account);
  if (cached && cached.expires > Date.now() + 30_000) return cached.value;
  const res = await send(
    "/auth/token",
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: ACCOUNTS[account] }) },
    5_000,
  );
  if (!res.ok) throw new FastApiError("Silnik AI odrzucił logowanie konta technicznego.");
  const body = TokenSchema.parse(await res.json());
  tokens.set(account, { value: body.access_token, expires: Date.now() + body.expires_in * 1000 });
  return body.access_token;
}

async function call<S extends z.ZodType>(
  schema: S,
  path: string,
  init: RequestInit = {},
  { account = "official", timeoutMs = 15_000 }: { account?: Account; timeoutMs?: number } = {},
): Promise<z.infer<S>> {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${await token(account)}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const res = await send(path, { ...init, headers }, timeoutMs);
  if (res.status === 401) tokens.delete(account);
  if (!res.ok) {
    const problem = ProblemSchema.safeParse(await res.json().catch(() => ({})));
    throw new FastApiError(problem.success && problem.data.detail ? problem.data.detail : `Błąd silnika AI (${res.status}).`);
  }
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new FastApiError(`Silnik AI zwrócił niezgodne dane (${path}).`);
  return parsed.data;
}

export type GeneratedDraft = { draftId: string; schema: FormSchema; flags: LintFlag[]; coi: unknown };

export async function generateDraft(file: { data: Uint8Array; name: string; mimeType: string }): Promise<GeneratedDraft> {
  const body = new FormData();
  body.append("file", new Blob([new Uint8Array(file.data)], { type: file.mimeType }), file.name);
  const ready = file.name.toLowerCase().endsWith(".json");
  const { draftId } = await call(z.object({ draftId: z.string() }), ready ? "/coi/import" : "/drafts", { method: "POST", body }, { timeoutMs: 180_000 });
  const draft = await call(FormDraftSchema, `/drafts/${draftId}`);
  const flags = await lintDraft(draftId);
  const coi = await call(z.unknown(), `/drafts/${draftId}/coi`);
  return { draftId, schema: draft.schema, flags, coi };
}

export async function relintDraft(draftId: string, schema?: FormSchema | null): Promise<{ flags: LintFlag[]; coi: unknown }> {
  if (schema) await call(z.unknown(), `/drafts/${draftId}`, { method: "PUT", body: JSON.stringify({ schema }) });
  const flags = await lintDraft(draftId);
  const coi = await call(z.unknown(), `/drafts/${draftId}/coi`);
  return { flags, coi };
}

function lintDraft(draftId: string): Promise<LintFlag[]> {
  return call(z.array(LintFlagSchema), `/drafts/${draftId}/lint`, { method: "POST" }, { timeoutMs: 120_000 });
}

