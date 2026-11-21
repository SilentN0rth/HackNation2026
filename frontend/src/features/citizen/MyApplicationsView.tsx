import { Link } from "react-router";
import { api } from "@/api";
import { AppStatusBadge, ArrowRight, ErrorBox, PageHeader, Skeleton } from "@/components/Feedback";
import { formatDate, useAsync } from "@/lib/useAsync";

export function MyApplicationsView() {
  const { data, error, loading } = useAsync(() => api.listMyApplications());

  return (
    <section className="max-w-4xl">
      <PageHeader crumbs={[{ label: "Twoje sprawy" }]} title="Twoje sprawy" />
      {loading && <Skeleton rows={3} />}
      {error && <ErrorBox message={error} />}
      {data?.length === 0 && <p className="border-y border-border py-12 text-center text-ink-3">Nie masz jeszcze żadnych wniosków.</p>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {data.map((a, i) => {
            const body = (
              <>
                <span className="min-w-0 flex-1">
                  <h2 className="row-title font-semibold text-ink">{a.formTitle}</h2>
                  <p className="mt-1 text-sm text-ink-3">
                    <span className="tabular-nums">{formatDate(a.updatedAt)}</span>
                    {a.confirmationNo && (
                      <>
                        <span aria-hidden className="mx-2 text-ink-3/50">·</span>
                        <span className="font-mono">{a.confirmationNo}</span>
                      </>
                    )}
                  </p>
                </span>
                <AppStatusBadge status={a.status} />
              </>
            );
            return (
              <li key={a.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
                {a.status === "draft" ? (
                  <Link
                    to={`/citizen/form/${a.formId}?app=${a.id}`}
                    className="row-link flex items-center gap-6 py-5"
                    aria-label={`Dokończ: ${a.formTitle}`}
                  >
                    {body}
                    <span className="flex w-24 items-center justify-end gap-1.5 text-sm font-semibold text-accent">
                      Dokończ
                      <ArrowRight className="row-arrow size-4" />
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-6 py-5">
                    {body}
                    <span className="w-24" />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
