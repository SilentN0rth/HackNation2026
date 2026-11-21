"use client";

import { useEffect } from "react";

/** Rejestruje service worker (tylko w buildzie produkcyjnym, żeby nie cache'ować dev serwera). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
