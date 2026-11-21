"use client";

import Link from "next/link";
import { buttonVariants, Table } from "@heroui/react";
import { api } from "@/api";
import { DraftStatusBadge, ErrorBox, Loading, OpenFlagCounts, PageHeader } from "@/components/Feedback";
import { formatDate, useAsync } from "@/lib/useAsync";

export function DashboardView() {
  const { data, error, loading } = useAsync(() => api.listDrafts());

  return (
    <section>
      <PageHeader
        title="Formularze"
        description="Wersje robocze wygenerowane z plików i opublikowane e-usługi."
        actions={
          <Link href="/official/upload" className={buttonVariants({ variant: "primary" })}>
            + Nowy formularz z pliku
          </Link>
        }
      />

      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Lista formularzy">
              <Table.Header>
                <Table.Column isRowHeader>Formularz</Table.Column>
                <Table.Column>Plik źródłowy</Table.Column>
                <Table.Column>Status</Table.Column>
                <Table.Column>Otwarte flagi</Table.Column>
                <Table.Column>Zmieniono</Table.Column>
                <Table.Column>
                  <span className="sr-only">Akcje</span>
                </Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => <p className="p-6 text-muted">Brak formularzy – wgraj pierwszy plik.</p>}>
                {data.map((d) => (
                  <Table.Row key={d.id} id={d.id}>
                    <Table.Cell className="font-medium">{d.title}</Table.Cell>
                    <Table.Cell className="font-mono text-xs">{d.sourceFile}</Table.Cell>
                    <Table.Cell>
                      <DraftStatusBadge status={d.status} />
                    </Table.Cell>
                    <Table.Cell>
                      <OpenFlagCounts errors={d.openErrors} warnings={d.openWarnings} />
                    </Table.Cell>
                    <Table.Cell className="whitespace-nowrap text-muted">{formatDate(d.updatedAt)}</Table.Cell>
                    <Table.Cell>
                      {d.status === "processing" ? (
                        <span className="text-sm text-muted">Przetwarzanie…</span>
                      ) : (
                        <Link
                          href={`/official/drafts/${d.id}`}
                          className={buttonVariants({ variant: "secondary", size: "sm" })}
                          aria-label={`Otwórz: ${d.title}`}
                        >
                          Otwórz
                        </Link>
                      )}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}
    </section>
  );
}
