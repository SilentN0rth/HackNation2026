"use client";

import Link from "next/link";
import { buttonVariants, Card } from "@heroui/react";
import { api } from "@/api";
import { AppStatusBadge, ErrorBox, Loading, PageHeader } from "@/components/Feedback";
import { formatDate, useAsync } from "@/lib/useAsync";

export function MyApplicationsView() {
  const { data, error, loading } = useAsync(() => api.listMyApplications());

  return (
    <section className="mx-auto max-w-3xl">
      <PageHeader title="Twoje sprawy" />
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data?.length === 0 && <p className="text-muted">Nie masz jeszcze żadnych wniosków.</p>}
      <ul className="flex flex-col gap-3">
        {data?.map((a) => (
          <li key={a.id}>
            <Card>
              <Card.Content className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="font-medium">{a.formTitle}</h2>
                  <p className="text-sm text-muted">
                    {formatDate(a.updatedAt)}
                    {a.confirmationNo && (
                      <>
                        {" · "}
                        <span className="font-mono">{a.confirmationNo}</span>
                      </>
                    )}
                  </p>
                </div>
                <AppStatusBadge status={a.status} />
                {a.status === "draft" && (
                  <Link
                    href={`/citizen/form/${a.formId}?app=${a.id}`}
                    className={buttonVariants({ variant: "secondary", size: "sm" })}
                    aria-label={`Dokończ: ${a.formTitle}`}
                  >
                    Dokończ
                  </Link>
                )}
              </Card.Content>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
