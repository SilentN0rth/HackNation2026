"use client";

import type { ReactNode } from "react";
import { TIME_ZONE, formatDateTime, formatTime, plural } from "./lib/format";
import { AUDIT_LABELS, type AiStatus, type AuditItem, type FormStatus } from "./lib/types";
import { auditUrl, editorUrl, formsListUrl, uploadUrl } from "./routes";
import { ArrowLink, Eyebrow, FormStatusDot, OpenFlags, PrimaryLink, RowLink, SectionTitle, StatusDot, ViewRoot } from "./ui/bits";
import { Counter, Rise, Stagger } from "./ui/motion";

export type DashboardData = {
  userName: string;
  stats: { draft: number; inReview: number; published: number; criticalOpen: number; applications: number; audit: number };
  recent: {
    id: number;
    title: string;
    status: FormStatus;
    aiStatus: AiStatus;
    sourceName: string | null;
    updatedAt: string;
    open: { errors: number; warnings: number };
  }[];
  formsTotal: number;
  audit: AuditItem[];
};

function greeting(now = new Date()) {
  const h = Number(new Intl.DateTimeFormat("pl-PL", { hour: "numeric", hourCycle: "h23", timeZone: TIME_ZONE }).format(now));
  return h < 5 || h >= 18 ? "Dobry wieczór" : "Dzień dobry";
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

export function DashboardClient({ data }: { data: DashboardData }) {
  const { stats } = data;
  const name = firstName(data.userName);
  const STATS: { key: string; value: number; label: string; accent?: boolean }[] = [
    { key: "draft", value: stats.draft, label: plural(stats.draft, "wersja robocza", "wersje robocze", "wersji roboczych") },
    { key: "in-review", value: stats.inReview, label: "do weryfikacji" },
    { key: "published", value: stats.published, label: plural(stats.published, "opublikowany", "opublikowane", "opublikowanych") },
    {
      key: "critical",
      value: stats.criticalOpen,
      label: plural(stats.criticalOpen, "otwarta uwaga krytyczna", "otwarte uwagi krytyczne", "otwartych uwag krytycznych"),
      accent: stats.criticalOpen > 0,
    },
    { key: "applications", value: stats.applications, label: plural(stats.applications, "wniosek obywatela", "wnioski obywateli", "wniosków obywateli") },
    { key: "audit", value: stats.audit, label: plural(stats.audit, "wpis w dzienniku", "wpisy w dzienniku", "wpisów w dzienniku") },
  ];

  return (
    <ViewRoot testId="panel-dashboard" className="panel-dashboard flex flex-col gap-20 sm:gap-28">
        <section className="grid gap-12 lg:grid-cols-[1.2fr_1fr] lg:items-end">
          <Stagger>
            <Rise>
              <Eyebrow className="mb-5">Panel urzędnika</Eyebrow>
            </Rise>
            <Rise>
              <h1 className="m-0 text-[2.75rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-6xl lg:text-[4rem]">
                {greeting()}
                {name ? `, ${name}` : ""}.
              </h1>
            </Rise>
            <Rise>
              <p className="mt-7 mb-0 max-w-xl text-lg leading-relaxed text-pretty text-ink-3 sm:text-xl">
                {stats.criticalOpen > 0
                  ? `Na decyzję czeka ${stats.criticalOpen} ${plural(stats.criticalOpen, "uwaga krytyczna", "uwagi krytyczne", "uwag krytycznych")}. Obsłuż je, zanim opublikujesz formularz.`
                  : "Wszystkie krytyczne uwagi są obsłużone. Wgraj kolejny blankiet albo opublikuj gotowe formularze."}
              </p>
            </Rise>
            <Rise className="mt-10 flex flex-wrap items-center gap-6">
              <PrimaryLink href={uploadUrl()}>Nowy z pliku</PrimaryLink>
              <ArrowLink href={formsListUrl()}>Formularze</ArrowLink>
              <ArrowLink href={auditUrl()}>Dziennik</ArrowLink>
            </Rise>
          </Stagger>

          <Stagger as="dl" delay={0.2} aria-label="Statystyki" className="m-0 grid grid-cols-2 border-t border-ink lg:mb-2">
            {STATS.map((s, i) => (
              <Rise
                key={s.key}
                data-testid={`stat-${s.key}`}
                className={`py-6 ${i % 2 ? "pl-6" : "pr-6"} ${i > 1 ? "border-t border-border" : ""}`}
              >
                <dt className="sr-only">{s.label}</dt>
                <dd className={`m-0 font-mono text-4xl font-semibold tracking-[-0.03em] tabular-nums ${s.accent ? "text-accent" : "text-ink"}`}>
                  <Counter value={s.value} delay={0.25 + i * 0.06} />
                </dd>
                <dd className="m-0 mt-1 text-sm text-ink-3">{s.label}</dd>
              </Rise>
            ))}
          </Stagger>
        </section>

        <section aria-labelledby="recent-forms" className="flex flex-col gap-8">
          <SectionTitle
            id="recent-forms"
            title="Ostatnio zmieniane"
            aside={<ArrowLink href={formsListUrl()}>{`Wszystkie formularze (${data.formsTotal})`}</ArrowLink>}
          />
          {data.recent.length === 0 ? (
            <EmptyRow title="Nie ma jeszcze formularzy" text="Wgraj pierwszy blankiet, a system przygotuje wersję elektroniczną." />
          ) : (
            <Stagger as="ul" className="m-0 list-none divide-y divide-border border-y border-ink p-0 [&>li:first-child]:border-t-0">
              {data.recent.map((f) => (
                <Rise as="li" key={f.id}>
                  <RowLink
                    href={editorUrl(f.id)}
                    title={f.title}
                    text={<span className="block truncate font-mono text-xs">{f.sourceName ?? "bez pliku źródłowego"}</span>}
                    meta={
                      <span className="hidden shrink-0 items-center gap-8 md:flex">
                        <span className="w-36">
                          {f.aiStatus === "error" ? <StatusDot label="Błąd silnika AI" tone="danger" /> : <FormStatusDot status={f.status} />}
                        </span>
                        <span className="w-52">
                          <OpenFlags errors={f.open.errors} warnings={f.open.warnings} />
                        </span>
                        <span className="w-36 text-sm text-ink-3 tabular-nums">{formatDateTime(f.updatedAt)}</span>
                      </span>
                    }
                  />
                </Rise>
              ))}
            </Stagger>
          )}
        </section>

        <section className="grid gap-16 lg:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-8">
            <SectionTitle title="Dziennik decyzji" aside={<ArrowLink href={auditUrl()}>Cały dziennik</ArrowLink>} />
            {data.audit.length === 0 ? (
              <EmptyRow title="Brak wpisów" text="Decyzje urzędników i systemu pojawią się tutaj." />
            ) : (
              <Stagger as="ol" data-testid="recent-audit" className="m-0 list-none border-t border-ink p-0">
                {data.audit.map((a) => (
                  <Rise as="li" key={a.id} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4 border-b border-border py-4">
                    <time dateTime={a.at} className="pt-0.5 font-mono text-sm text-ink-3 tabular-nums">
                      {formatTime(a.at)}
                    </time>
                    <div className="min-w-0">
                      <p className="m-0 font-semibold text-ink">
                        {AUDIT_LABELS[a.action]}
                        <span className="font-normal text-ink-3"> · {a.actor}</span>
                      </p>
                      <p className="m-0 mt-1 text-sm leading-relaxed text-ink-2">{a.details}</p>
                      {a.formTitle && a.formId != null && (
                        <ArrowLink href={editorUrl(a.formId)} className="mt-1.5 text-sm">
                          {a.formTitle}
                        </ArrowLink>
                      )}
                    </div>
                  </Rise>
                ))}
              </Stagger>
            )}
          </div>

          <div className="flex flex-col gap-8">
            <SectionTitle title="Na skróty" />
            <Stagger as="ul" className="m-0 list-none divide-y divide-border border-y border-ink p-0">
              <QuickLink href={uploadUrl()} title="Nowy z pliku" text="Wgraj blankiet i wygeneruj strukturę" />
              <QuickLink href={formsListUrl()} title="Formularze" text="Wersje robocze i opublikowane e-usługi" />
              <QuickLink href={auditUrl()} title="Dziennik" text="Kto, kiedy i na jakiej podstawie zatwierdził zmianę" />
              <QuickLink href="/citizen" title="Podgląd dla obywatela" text="Tak formularz zobaczy mieszkaniec" />
            </Stagger>
          </div>
        </section>
    </ViewRoot>
  );
}

function QuickLink({ href, title, text }: { href: string; title: string; text: ReactNode }) {
  return (
    <Rise as="li">
      <RowLink href={href} title={title} text={text} />
    </Rise>
  );
}

function EmptyRow({ title, text }: { title: string; text: string }) {
  return (
    <div className="border-y border-border py-14 text-center">
      <p className="m-0 text-lg font-semibold text-ink">{title}</p>
      <p className="m-0 mt-1 text-ink-3">{text}</p>
    </div>
  );
}
