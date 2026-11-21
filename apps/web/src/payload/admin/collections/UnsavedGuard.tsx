"use client";

import { useFormModified, useFormProcessing } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Strażnik niezapisanych zmian (zamiast natywnego LeaveWithoutSaving Payloada):
 * zamknięcie karty → okno przeglądarki, kliknięcie linku w panelu → HeroUI AlertDialog.
 */
export function UnsavedGuard() {
  const modified = useFormModified();
  const processing = useFormProcessing();
  const router = useRouter();
  const [next, setNext] = useState<string | null>(null);
  const active = modified && !processing;

  useEffect(() => {
    if (!active) return;
    const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      setNext(url.pathname + url.search);
    };
    window.addEventListener("beforeunload", onUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [active]);

  return (
    <ConfirmDialog
      isOpen={next !== null}
      onOpenChange={(o) => !o && setNext(null)}
      title="Opuścić bez zapisywania?"
      confirmLabel="Opuść stronę"
      onConfirm={() => {
        const href = next;
        setNext(null);
        if (href) router.push(href);
      }}
    >
      Masz niezapisane zmiany. Jeśli opuścisz stronę, zostaną utracone.
    </ConfirmDialog>
  );
}
