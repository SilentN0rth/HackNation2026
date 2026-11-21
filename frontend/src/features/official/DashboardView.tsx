"use client";

import Link from "next/link";
import { api } from "@/api";
import {
  ArrowRight,
  DraftStatusBadge,
  ErrorBox,
  OpenFlagCounts,
  PageHeader,
  primaryLink,
  Skeleton,
} from "@/components/Feedback";
import { formatDate, useAsync } from "@/lib/useAsync";

export function DashboardView() {
  const { data, error, loading } = useAsync(() => api.listDrafts());

  return (
    <section>
      <PageHeader
        crumbs={[{ label: "Formularze" }]}
        title="Formularze"
        description="Wersje robocze wygenerowane z plików oraz opublikowane e-usługi."
        actions={
          <Link href="/official/upload" className={primaryLink}>
            Nowy z pliku
          </Link>
        }
      />

      {loading && <Skeleton />}
      {error && <ErrorBox message={error} />}
      {data && data.length === 0 && (
        <div className="border-y border-border py-16 text-center">
          <p className="text-lg font-semibold text-ink">Nie ma jeszcze formularzy</p>
          <p className="mt-1 text-ink-3">Wgraj pierwszy blankiet, a system przygotuje wersję elektroniczną.</p>
        </div>
      )}
      {data && data.length > 0 && (
        <>
          <div className="hidden grid-cols-[minmax(0,1fr)_170px_200px_150px_20px] gap-6 border-b border-ink pb-3 text-xs font-semibold tracking-wide text-ink-3 uppercase md:grid">
            <span>Formularz</span>
            <span>Status</span>
            <span>Uwagi</span>
            <span>Zmieniono</span>
            <span />
          </div>
          <ul className="divide-y divide-border border-b border-border">
            {data.map((d, i) => {
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="row-title block font-semibold text-ink">{d.title}</span>
                    <span className="mt-1 block truncate font-mono text-xs text-ink-3">{d.sourceFile}</span>
                  </span>
                  <DraftStatusBadge status={d.status} />
                  <OpenFlagCounts errors={d.openErrors} warnings={d.openWarnings} />
                  <span className="text-sm text-ink-3 tabular-nums">{formatDate(d.updatedAt)}</span>
                  {d.status === "processing" ? (
                    <span aria-hidden className="pulse-dot size-1.5 rounded-full bg-ink-3" />
                  ) : (
                    <ArrowRight className="row-arrow size-5 text-accent" />
                  )}
                </>
              );
              const cls =
                "grid items-center gap-x-6 gap-y-2 py-5 md:grid-cols-[minmax(0,1fr)_170px_200px_150px_20px]";
              return (
                <li key={d.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                  {d.status === "processing" ? (
                    <div className={cls} aria-label={`${d.title}, przetwarzanie`}>
                      {body}
                    </div>
                  ) : (
                    <Link href={`/official/drafts/${d.id}`} className={`row-link ${cls}`}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
