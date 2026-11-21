"use client";

import { Button, Label, ListBox, Select } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import type { AuditAction } from "@/types";
import { dayKey, dayLabel, formatTime, plural } from "./lib/format";
import { AUDIT_LABELS, type AuditItem } from "./lib/types";
import { ease } from "./motion";
import { editorUrl } from "./routes";
import { ArrowLink, PageHeader, StatusDot, ViewRoot } from "./ui/bits";
import { Rise, Stagger } from "./ui/motion";

const ALL = "__all";

const ACTION_TONE: Record<AuditAction, "neutral" | "navy" | "success" | "warning" | "danger" | "accent"> = {
  upload: "neutral",
  draft_generated: "navy",
  linters_run: "navy",
  field_edited: "neutral",
  flag_fixed: "success",
  flag_rejected: "warning",
  published: "accent",
};

function FilterSelect({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
  testId: string;
}) {
  return (
    <Select value={value} onChange={(k) => onChange(k == null ? ALL : String(k))} className="flex min-w-0 flex-col gap-1.5" data-testid={testId}>
      <Label className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {[{ id: ALL, label: "Wszystkie" }, ...options].map((o) => (
            <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
              {o.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

export function AuditClient({ items, initialForm }: { items: AuditItem[]; initialForm: string | null }) {
  const reduce = useReducedMotion();
  const [form, setForm] = useState(initialForm && items.some((i) => String(i.formId) === initialForm) ? initialForm : ALL);
  const [action, setAction] = useState(ALL);
  const [actor, setActor] = useState(ALL);

  const formOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const i of items) if (i.formId != null) seen.set(String(i.formId), i.formTitle ?? `Formularz #${i.formId} (usunięty)`);
    return [...seen].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label, "pl"));
  }, [items]);
  const actorOptions = useMemo(() => [...new Set(items.map((i) => i.actor))].sort((a, b) => a.localeCompare(b, "pl")).map((a) => ({ id: a, label: a })), [items]);
  const actionOptions = (Object.keys(AUDIT_LABELS) as AuditAction[]).map((a) => ({ id: a, label: AUDIT_LABELS[a] }));

  const filtered = items.filter(
    (i) => (form === ALL || String(i.formId) === form) && (action === ALL || i.action === action) && (actor === ALL || i.actor === actor),
  );
  const days = useMemo(() => {
    const groups = new Map<string, AuditItem[]>();
    for (const i of filtered) {
      const key = dayKey(i.at);
      groups.set(key, [...(groups.get(key) ?? []), i]);
    }
    return [...groups];
  }, [filtered]);
  const active = form !== ALL || action !== ALL || actor !== ALL;

  return (
    <ViewRoot testId="panel-audit">
      <PageHeader
        crumbs={[{ label: "Pulpit", href: "/official" }, { label: "Dziennik decyzji" }]}
        eyebrow="Dziennik decyzji"
        title="Kto, kiedy i na jakiej podstawie"
        description="Każde wgranie pliku, wynik analizy i decyzja urzędnika. Wpisy tworzy system – nie da się ich zmienić ani usunąć."
      />

      <Stagger delay={0.15} className="flex flex-col gap-12">
        <Rise className="grid gap-4 border-t border-ink pt-6 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_auto] lg:items-end">
          <FilterSelect label="Formularz" value={form} onChange={setForm} options={formOptions} testId="filter-form" />
          <FilterSelect label="Akcja" value={action} onChange={setAction} options={actionOptions} testId="filter-action" />
          <FilterSelect label="Kto" value={actor} onChange={setActor} options={actorOptions} testId="filter-actor" />
          <div className="flex items-center gap-4 sm:col-span-3 lg:col-span-1">
            <span className="font-mono text-sm text-ink-3 tabular-nums" aria-live="polite" data-testid="audit-count">
              {filtered.length} {plural(filtered.length, "wpis", "wpisy", "wpisów")}
            </span>
            <AnimatePresence>
              {active && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      setForm(ALL);
                      setAction(ALL);
                      setActor(ALL);
                    }}
                  >
                    Wyczyść
                  </Button>
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </Rise>

        <Rise>
          {days.length === 0 ? (
            <div className="border-y border-border py-16 text-center">
              <p className="m-0 text-lg font-semibold text-ink">Brak wpisów</p>
              <p className="m-0 mt-1 text-ink-3">Zmień filtry, żeby zobaczyć więcej.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-12" data-testid="audit-timeline">
              <AnimatePresence initial={false} mode="popLayout">
                {days.map(([key, entries]) => (
                  <motion.section
                    key={key}
                    layout={!reduce}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease }}
                    aria-label={dayLabel(key)}
                    className="grid gap-4 lg:grid-cols-[200px_minmax(0,1fr)]"
                  >
                    <h2 className="m-0 border-t border-ink pt-4 text-lg font-semibold tracking-[-0.01em] text-ink">
                      {dayLabel(key)}
                      <span className="mt-1 block font-mono text-xs font-normal text-ink-3">
                        {entries.length} {plural(entries.length, "wpis", "wpisy", "wpisów")}
                      </span>
                    </h2>
                    <ol className="m-0 list-none border-t border-ink p-0">
                      <AnimatePresence initial={false}>
                        {entries.map((a) => (
                          <motion.li
                            key={a.id}
                            layout={!reduce}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.25, ease }}
                            data-testid="audit-entry"
                            className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 border-b border-border py-4 sm:grid-cols-[4rem_minmax(0,1fr)_auto]"
                          >
                            <time dateTime={a.at} className="pt-0.5 font-mono text-sm text-ink-3 tabular-nums">
                              {formatTime(a.at)}
                            </time>
                            <div className="min-w-0">
                              <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <StatusDot label={<span className="font-semibold text-ink">{AUDIT_LABELS[a.action]}</span>} tone={ACTION_TONE[a.action]} />
                                <span className="text-sm text-ink-3">{a.actor}</span>
                              </p>
                              <p className="m-0 mt-1.5 text-sm leading-relaxed text-ink-2">{a.details}</p>
                              {a.formId != null && (
                                <div className="mt-1.5">
                                  {a.formTitle ? (
                                    <ArrowLink href={editorUrl(a.formId)} className="text-sm">
                                      {a.formTitle}
                                    </ArrowLink>
                                  ) : (
                                    <span className="text-sm text-ink-3">Formularz #{a.formId} (usunięty)</span>
                                  )}
                                </div>
                              )}
                            </div>
                            {a.aiOutputRef && (
                              <span className="col-start-2 font-mono text-xs break-words text-ink-3 sm:col-start-3 sm:max-w-48 sm:text-right" title="Wersja modelu / promptu">
                                {a.aiOutputRef}
                              </span>
                            )}
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ol>
                  </motion.section>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Rise>
      </Stagger>
    </ViewRoot>
  );
}
