"use client";

import { Button, Switch } from "@heroui/react";
import { toast } from "@payloadcms/ui";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ShellData } from "./DocumentShell";
import { useRise } from "./motion";
import { SectionLabel, StatusChip } from "./ui";
import type { DiffRow, VersionRow } from "./versions";

/** Jedna wersja: różnice pól względem poprzedniej wersji i przywrócenie. */
export function VersionView({ shell, version, diff, compareLabel }: { shell: ShellData; version: VersionRow; diff: DiffRow[]; compareLabel: string }) {
  const { item, list, layout } = useRise();
  const router = useRouter();
  const [onlyChanged, setOnlyChanged] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const rows = onlyChanged ? diff.filter((d) => d.changed) : diff;
  const changedCount = diff.filter((d) => d.changed).length;

  async function restore() {
    setBusy(true);
    try {
      const path = shell.kind === "collection" ? `/${shell.slug}/versions/${version.id}` : `/globals/${shell.slug}/versions/${version.id}`;
      const res = await fetch(`${shell.apiRoute}${path}?depth=0`, { method: "POST", credentials: "include", headers: { "Accept-Language": "pl" } });
      const json = (await res.json().catch(() => ({}))) as { message?: string; errors?: { message: string }[] };
      if (!res.ok) throw new Error(json.errors?.[0]?.message ?? json.message ?? `Błąd ${res.status}`);
      toast.success("Przywrócono wersję.");
      router.push(shell.base);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <div data-testid="version-view">
      <div className="mb-8 flex flex-wrap items-end gap-6 border-t border-ink pt-5">
        <div className="min-w-0 flex-1">
          <SectionLabel>Wersja z {version.date}</SectionLabel>
          <p className="mt-2 text-muted">
            Porównanie z {compareLabel}. Zmienione pola: <span className="font-mono text-ink tabular-nums">{changedCount}</span>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusChip label={version.status === "published" ? "Opublikowana" : "Wersja robocza"} tone={version.status === "published" ? "success" : "neutral"} />
            {version.latest && <StatusChip label="Bieżąca" tone="accent" />}
          </div>
        </div>
        <Switch isSelected={onlyChanged} onChange={setOnlyChanged} data-testid="only-changed">
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
          <Switch.Content>
            <span className="text-sm text-ink">Tylko zmienione</span>
          </Switch.Content>
        </Switch>
        <Button variant="secondary" onPress={() => router.push(`${shell.base}/versions`)}>
          Wszystkie wersje
        </Button>
        {!version.latest && (
          <Button variant="primary" onPress={() => setConfirm(true)} data-testid="restore-version">
            Przywróć tę wersję
          </Button>
        )}
      </div>

      {rows.length === 0 ? (
        <p className="border-y border-border py-10 text-center text-muted">Ta wersja nie różni się od poprzedniej.</p>
      ) : (
        <motion.ul variants={list} initial="hidden" animate="show" className="divide-y divide-border border-y border-border" data-testid="version-diff">
          <AnimatePresence initial={false}>
            {rows.map((d) => (
              <motion.li key={d.name} variants={item} layout transition={layout} exit={{ opacity: 0 }} className="grid gap-3 py-5 md:grid-cols-[12rem_1fr_1fr] md:gap-6">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  {d.changed && <span aria-hidden className="size-1.5 rounded-full bg-accent" />}
                  {d.label}
                </p>
                <DiffValue label="Przed" value={d.before} tone={d.changed ? "before" : "same"} />
                <DiffValue label="Po" value={d.after} tone={d.changed ? "after" : "same"} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}

      <ConfirmDialog isOpen={confirm} onOpenChange={setConfirm} title="Przywrócić tę wersję?" confirmLabel="Przywróć" tone="accent" busy={busy} onConfirm={() => void restore()}>
        Bieżąca treść dokumentu zostanie zastąpiona wersją z {version.date}. Poprzednia treść zostanie w historii wersji.
      </ConfirmDialog>
    </div>
  );
}

function DiffValue({ label, value, tone }: { label: string; value: string; tone: "before" | "after" | "same" }) {
  const box = tone === "before" ? "border-l-2 border-danger bg-danger-soft/60" : tone === "after" ? "border-l-2 border-success bg-success-soft/60" : "border-l-2 border-border";
  return (
    <div className={`min-w-0 px-3 py-2 ${box}`}>
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</p>
      <pre className="mt-1 max-h-60 overflow-auto font-mono text-[13px] leading-relaxed break-words whitespace-pre-wrap text-ink">{value || "—"}</pre>
    </div>
  );
}
