/** Wywołania REST Payloada (/api/payload) z widoków panelu – sesja z ciasteczka panelu. */

const BASE = "/api/payload";

type Query = Record<string, string | number | boolean | undefined>;

export class RestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function rest<T = unknown>(path: string, init: RequestInit = {}, query: Query = {}): Promise<T> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined) params.set(key, String(value));
  const qs = params.size ? `?${params}` : "";
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new RestError("Brak połączenia z serwerem. Spróbuj ponownie.", 0);
  }
  const body = (await res.json().catch(() => ({}))) as { errors?: { message?: string; data?: { errors?: { message?: string }[] } }[] };
  if (!res.ok) {
    const first = body.errors?.[0];
    const detail = first?.data?.errors?.[0]?.message;
    throw new RestError(detail ?? first?.message ?? `Błąd serwera (${res.status}).`, res.status);
  }
  return body as T;
}

/** PATCH/POST zwracają { doc }, endpointy własne – sam dokument. */
export const docOf = <T>(body: unknown): T => ((body as { doc?: T }).doc ?? body) as T;

export const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
