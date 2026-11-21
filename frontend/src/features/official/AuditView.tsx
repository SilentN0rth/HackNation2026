"use client";

import { Table } from "@heroui/react";
import { api } from "@/api";
import { ErrorBox, Loading, PageHeader } from "@/components/Feedback";
import { formatDate, useAsync } from "@/lib/useAsync";
import type { AuditAction } from "@/types";

const ACTION_LABELS: Record<AuditAction, string> = {
  upload: "Wgranie pliku",
  draft_generated: "Wygenerowanie przez AI",
  linters_run: "Uruchomienie linterów",
  field_edited: "Edycja",
  flag_fixed: "Flaga poprawiona",
  flag_rejected: "Flaga odrzucona",
  published: "Publikacja",
};

export function AuditView({ draftId }: { draftId?: string }) {
  const { data, error, loading } = useAsync(() => api.getAuditTrail(draftId), [draftId]);

  return (
    <section>
      <PageHeader title="Audit Trail" description="Kto, kiedy i na podstawie jakiego wyniku AI podjął decyzję." />
      {loading && <Loading />}
      {error && <ErrorBox message={error} />}
      {data && (
        <Table>
          <Table.ScrollContainer>
            <Table.Content aria-label="Dziennik decyzji">
              <Table.Header>
                <Table.Column>Kiedy</Table.Column>
                <Table.Column>Kto</Table.Column>
                <Table.Column isRowHeader>Akcja</Table.Column>
                <Table.Column>Szczegóły</Table.Column>
                <Table.Column>Wynik AI</Table.Column>
              </Table.Header>
              <Table.Body renderEmptyState={() => <p className="p-6 text-muted">Brak wpisów.</p>}>
                {data.map((a) => (
                  <Table.Row key={a.id} id={a.id}>
                    <Table.Cell className="whitespace-nowrap text-muted">{formatDate(a.at)}</Table.Cell>
                    <Table.Cell>{a.userName}</Table.Cell>
                    <Table.Cell className="font-medium">{ACTION_LABELS[a.action]}</Table.Cell>
                    <Table.Cell>{a.details}</Table.Cell>
                    <Table.Cell className="font-mono text-xs">{a.aiOutputRef ?? "—"}</Table.Cell>
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
