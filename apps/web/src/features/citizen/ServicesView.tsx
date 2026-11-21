"use client";

import Link from "next/link";
import { api } from "@/api";
import { ArrowRight, ErrorBox, PageHeader, Skeleton } from "@/components/Feedback";
import { useAsync } from "@/lib/useAsync";

export function ServicesView() {
  const { data, error, loading } = useAsync(() => api.listPublishedForms());

  return (
    <section className="max-w-4xl">
      <PageHeader
        crumbs={[{ label: "Usługi" }]}
        title="Załatw sprawę online"
        description="Wybierz usługę. Część danych możemy uzupełnić za Ciebie, a przed wysłaniem wszystko sprawdzisz."
      />
      {loading && <Skeleton rows={3} />}
      {error && <ErrorBox message={error} />}
      {data?.length === 0 && <p className="border-y border-border py-12 text-center text-ink-3">Nie ma jeszcze opublikowanych usług.</p>}
      {data && data.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {data.map((f, i) => (
            <li key={f.id} className="rise" style={{ "--i": i } as React.CSSProperties}>
              <Link
                href={`/citizen/form/${f.id}`}
                className="row-link flex items-center gap-8 py-7"
                aria-label={`Rozpocznij: ${f.schema.title}`}
              >
                <span className="min-w-0 flex-1">
                  <h2 className="row-title text-xl font-semibold tracking-[-0.01em] text-ink">{f.schema.title}</h2>
                  <p className="mt-1.5 leading-relaxed text-ink-3">{f.summary}</p>
                  <p className="mt-3 text-sm text-ink-3">
                    <span className="tabular-nums">około {f.estimatedMinutes} min</span>
                    <span aria-hidden className="mx-2 text-ink-3/50">·</span>
                    {f.schema.issuer}
                  </p>
                </span>
                <ArrowRight className="row-arrow size-5 shrink-0 text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
