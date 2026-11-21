"use client";

import { Alert, Chip, Spinner } from "@heroui/react";
import type { ApplicationStatus, DraftStatus, Severity } from "@/types";
import { SEVERITY_LABELS } from "@/types";

type ChipColor = "default" | "accent" | "success" | "warning" | "danger";

export const Loading = ({ text = "Wczytywanie…" }: { text?: string }) => (
  <div role="status" className="flex items-center gap-3 py-6 text-muted">
    <Spinner size="sm" color="current" aria-hidden />
    <span>{text}</span>
  </div>
);

export const ErrorBox = ({ message }: { message: string }) => (
  <Alert status="danger" className="my-4">
    <Alert.Indicator />
    <Alert.Content>
      <Alert.Title>Coś poszło nie tak</Alert.Title>
      <Alert.Description>{message}</Alert.Description>
    </Alert.Content>
  </Alert>
);

const DRAFT: Record<DraftStatus, [string, ChipColor]> = {
  processing: ["W przetwarzaniu", "default"],
  review: ["Do zatwierdzenia", "warning"],
  published: ["Opublikowany", "success"],
};
const APP: Record<ApplicationStatus, [string, ChipColor]> = {
  draft: ["Szkic", "default"],
  sent: ["Wysłany", "accent"],
  accepted: ["Przyjęty", "success"],
};
const SEVERITY: Record<Severity, ChipColor> = { error: "danger", warning: "warning", info: "accent" };

export const StatusChip = ({ label, color }: { label: string; color: ChipColor }) => (
  <Chip size="sm" variant="soft" color={color}>
    {label}
  </Chip>
);

export const DraftStatusBadge = ({ status }: { status: DraftStatus }) => (
  <StatusChip label={DRAFT[status][0]} color={DRAFT[status][1]} />
);
export const AppStatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <StatusChip label={APP[status][0]} color={APP[status][1]} />
);
export const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <StatusChip label={SEVERITY_LABELS[severity]} color={SEVERITY[severity]} />
);

/** Liczniki otwartych flag (lista formularzy, panel lintera). */
export function OpenFlagCounts({
  errors,
  warnings,
  infos,
  showZero = false,
}: {
  errors: number;
  warnings: number;
  infos?: number;
  showZero?: boolean;
}) {
  const items: [number, string, Severity][] = [
    [errors, "krytyczne", "error"],
    [warnings, "ostrzeżenia", "warning"],
    ...(infos !== undefined ? [[infos, "sugestie", "info"] as [number, string, Severity]] : []),
  ];
  const visible = showZero ? items : items.filter(([n]) => n > 0);
  if (visible.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {visible.map(([n, label, sev]) => (
        <StatusChip key={sev} label={`${n} ${label}`} color={SEVERITY[sev]} />
      ))}
    </span>
  );
}

/** Nagłówek strony z opcjonalnymi akcjami po prawej. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-4">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl">{title}</h1>
        {description && <div className="mt-1 text-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
