"use client";

import { useEffect } from "react";

/**
 * Rejestruje service worker (tylko w buildzie produkcyjnym, żeby nie cache'ować dev serwera).
 * `?v=` to id buildu – nowy build to nowy URL skryptu, więc i nowy cache.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(process.env.NEXT_PUBLIC_BUILD_ID ?? "dev")}`)
      .catch(() => {});
  }, []);
  return null;
}
