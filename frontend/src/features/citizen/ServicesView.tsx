"use client";

import Link from "next/link";
import { buttonVariants, Card } from "@heroui/react";
import { api } from "@/api";
import { ErrorBox, Loading, PageHeader } from "@/components/Feedback";
import { useAsync } from "@/lib/useAsync";

export function ServicesView() {
  const { data, error, loading } = useAsync(() => api.listPublishedForms());

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader title="Załatw sprawę online" />
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data?.length === 0 && <p className="text-muted">Nie ma jeszcze opublikowanych usług.</p>}
      <ul className="flex flex-col gap-4">
        {data?.map((f) => (
          <li key={f.id}>
            <Card>
              <Card.Header>
                <Card.Title className="text-lg" render={(props) => <h2 {...props} />}>
                  {f.schema.title}
                </Card.Title>
                <Card.Description>{f.summary}</Card.Description>
              </Card.Header>
              <Card.Footer className="flex flex-wrap items-center gap-3">
                <span className="text-sm text-muted">
                  ok. {f.estimatedMinutes} min · {f.schema.issuer}
                </span>
                <Link
                  href={`/citizen/form/${f.id}`}
                  className={`${buttonVariants({ variant: "primary" })} ml-auto`}
                  aria-label={`Rozpocznij: ${f.schema.title}`}
                >
                  Rozpocznij
                </Link>
              </Card.Footer>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
