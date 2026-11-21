"use client";

import { api } from "@/api";
import { ErrorBox, PageHeader, Skeleton } from "@/components/Feedback";
import { formatDate, useAsync } from "@/lib/useAsync";
import type { AuditAction } from "@/types";

const ACTION_LABELS: Record<AuditAction, string> = {
  upload: "Wgranie pliku",
  draft_generated: "Wygenerowanie struktury",
  linters_run: "Kontrola jakości",
  field_edited: "Edycja pola",
  flag_fixed: "Uwaga poprawiona",
  flag_rejected: "Uwaga odrzucona",
  published: "Publikacja",
};

export function AuditView({ draftId }: { draftId?: string }) {
  const { data, error, loading } = useAsync(() => api.getAuditTrail(draftId), [draftId]);

  return (
    <section>
      <PageHeader
        crumbs={[{ label: "Dziennik decyzji" }]}
        title="Dziennik decyzji"
        description="Kto, kiedy i na podstawie którego wyniku analizy podjął decyzję."
      />
      {loading && <Skeleton rows={6} />}
      {error && <ErrorBox message={error} />}
      {data && data.length === 0 && <p className="border-y border-border py-12 text-center text-ink-3">Brak wpisów.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">Dziennik decyzji</caption>
            <thead>
              <tr className="border-b border-ink text-xs font-semibold tracking-wide text-ink-3 uppercase">
                <th scope="col" className="py-3 pr-6 font-semibold">Kiedy</th>
                <th scope="col" className="py-3 pr-6 font-semibold">Kto</th>
                <th scope="col" className="py-3 pr-6 font-semibold">Akcja</th>
                <th scope="col" className="py-3 pr-6 font-semibold">Szczegóły</th>
                <th scope="col" className="py-3 font-semibold">Wynik analizy</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a, i) => (
                <tr key={a.id} className="rise border-b border-border align-top" style={{ "--i": i } as React.CSSProperties}>
                  <td className="py-4 pr-6 text-sm whitespace-nowrap text-ink-3 tabular-nums">{formatDate(a.at)}</td>
                  <td className="py-4 pr-6 text-sm whitespace-nowrap">{a.userName}</td>
                  <th scope="row" className="py-4 pr-6 font-semibold whitespace-nowrap text-ink">
                    {ACTION_LABELS[a.action]}
                  </th>
                  <td className="py-4 pr-6 text-sm leading-relaxed text-ink-2">{a.details}</td>
                  <td className="py-4 font-mono text-xs text-ink-3">{a.aiOutputRef ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
