"use client";

import { useConfig } from "@payloadcms/ui";
import { formatAdminURL } from "payload/shared";
import { useCallback } from "react";

/** Błąd REST Payloada: komunikat ogólny i błędy przypisane do pól (path → message). */
export class PayloadRestError extends Error {
  constructor(
    message: string,
    readonly fields: Record<string, string> = {},
    readonly status = 0,
  ) {
    super(message);
  }
}

type ErrorBody = { errors?: { message?: string; data?: { errors?: { path?: string; message?: string }[] } }[] };

async function parseError(res: Response): Promise<PayloadRestError> {
  const body = (await res.json().catch(() => ({}))) as ErrorBody;
  const first = body.errors?.[0];
  const fields = Object.fromEntries(
    (first?.data?.errors ?? []).filter((e) => e.path && e.message).map((e) => [e.path!, e.message!]),
  );
  return new PayloadRestError(first?.message ?? "Nie udało się połączyć z serwerem. Spróbuj ponownie.", fields, res.status);
}

/** Wywołania endpointów kolekcji użytkowników (login, first-register, forgot-password, logout, me…). */
export function useUsersApi() {
  const {
    config: {
      serverURL,
      routes: { admin: adminRoute, api: apiRoute },
      admin: { user: userSlug, routes: adminRoutes },
    },
  } = useConfig();

  const request = useCallback(
    async <T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> => {
      const res = await fetch(formatAdminURL({ apiRoute, path: `/${userSlug}${path}`, serverURL }), {
        method: init.method ?? "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Accept-Language": "pl" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      if (!res.ok) throw await parseError(res);
      return (await res.json()) as T;
    },
    [apiRoute, serverURL, userSlug],
  );

  /** Adres widoku panelu, np. adminUrl("/forgot"). */
  const adminUrl = useCallback(
    (path: `/${string}` | "" = "") => formatAdminURL({ adminRoute, path: path || "/", serverURL }),
    [adminRoute, serverURL],
  );

  return { request, adminUrl, adminRoutes, userSlug };
}
