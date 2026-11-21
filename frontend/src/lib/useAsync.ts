"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

interface Result<T> {
  /** Dla jakiego zestawu `deps` (i którego przeładowania) jest ten wynik. */
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Ładowanie danych z api z obsługą błędu i ponownego pobrania.
 * `deps` – jak w useEffect: zmiana którejkolwiek wartości pobiera dane od nowa.
 * Odpowiedź, która przyjdzie po zmianie `deps` albo odmontowaniu, jest ignorowana.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const fnRef = useRef(fn);
  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  const [nonce, setNonce] = useState(0);
  const key = `${JSON.stringify(deps)}#${nonce}`;
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fnRef.current().then(
      (data) => !cancelled && setResult({ key, data, error: null }),
      (e: unknown) => !cancelled && setResult((prev) => ({ key, data: prev?.data ?? null, error: errorMessage(e) })),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  const setData = useCallback(
    (data: T) => setResult((prev) => ({ key: prev?.key ?? "", error: null, data })),
    [],
  );
  const reload = useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: result?.data ?? null,
    setData,
    error: result?.key === key ? result.error : null,
    loading: result?.key !== key,
    reload,
  };
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
