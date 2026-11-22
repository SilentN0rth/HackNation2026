"use client";

import { useAuth, useConfig } from "@payloadcms/ui";
import { MotionConfig } from "motion/react";
import { usePathname } from "next/navigation";
import { formatAdminURL } from "payload/shared";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type PanelSettings = { density: "comfortable" | "compact"; animations: boolean; defaultView: "dashboard" | "forms" | "audit-log" };

const DEFAULTS: PanelSettings = { density: "comfortable", animations: true, defaultView: "dashboard" };

type Ctx = { settings: PanelSettings; save: (patch: Partial<PanelSettings>) => Promise<void> };
const SettingsContext = createContext<Ctx>({ settings: DEFAULTS, save: async () => undefined });

export const usePanelSettings = () => useContext(SettingsContext);

export function Providers({ children }: { children?: ReactNode }) {
  const { user } = useAuth();
  const {
    config: { serverURL, routes, admin },
  } = useConfig();
  const pathname = usePathname();
  const loggingOut = [admin.routes.logout, admin.routes.inactivity].some((r) => r && pathname.endsWith(r));
  const [settings, setSettings] = useState<PanelSettings>(DEFAULTS);
  const endpoint = formatAdminURL({ apiRoute: routes.api, path: "/globals/settings", serverURL });

  useEffect(() => {
    if (!user || loggingOut) return;
    let live = true;
    fetch(endpoint, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Partial<PanelSettings> | null) => live && data && setSettings((s) => ({ ...s, ...pick(data) })))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [endpoint, user, loggingOut]);

  useEffect(() => {
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.animations = settings.animations ? "on" : "off";
  }, [settings.density, settings.animations]);

  const save = useCallback(
    async (patch: Partial<PanelSettings>) => {
      const res = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Nie udało się zapisać preferencji.");
      setSettings((s) => ({ ...s, ...patch }));
    },
    [endpoint],
  );

  const value = useMemo(() => ({ settings, save }), [settings, save]);

  return (
    <SettingsContext.Provider value={value}>
      {/* „user” szanuje prefers-reduced-motion; wyłączone animacje w preferencjach = zawsze bez ruchu. */}
      <MotionConfig reducedMotion={settings.animations ? "user" : "always"}>{children}</MotionConfig>
    </SettingsContext.Provider>
  );
}

function pick(data: Partial<PanelSettings>): Partial<PanelSettings> {
  const out: Partial<PanelSettings> = {};
  if (data.density === "compact" || data.density === "comfortable") out.density = data.density;
  if (typeof data.animations === "boolean") out.animations = data.animations;
  if (data.defaultView) out.defaultView = data.defaultView;
  return out;
}
