import { Card } from "@heroui/react";
import { OpenFlagCounts } from "@/components/Feedback";
import { FlagCard } from "@/components/FlagCard";
import { canPublish, countOpen, sortFlags } from "@/lib/lint";
import type { LintFlag } from "@/types";

interface Props {
  flags: LintFlag[];
  busy: boolean;
  onSelectField: (fieldId: string) => void;
  onResolve: (flagId: string, action: "fixed" | "rejected", justification?: string) => void;
}

export function LintPanel({ flags, busy, onSelectField, onResolve }: Props) {
  const open = countOpen(flags);
  return (
    <aside aria-label="Panel lintera" className="flex flex-col gap-3">
      <Card>
        <Card.Header>
          <Card.Title className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Kontrola jakości</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <OpenFlagCounts errors={open.errors} warnings={open.warnings} infos={open.infos} showZero />
          <p id="publish-hint" className="text-sm text-muted" aria-live="polite">
            {canPublish(flags)
              ? "Wszystkie krytyczne uwagi są obsłużone. Możesz opublikować formularz."
              : "Opublikujesz formularz, gdy obsłużysz wszystkie krytyczne uwagi."}
          </p>
        </Card.Content>
      </Card>
      {sortFlags(flags).map((flag) => (
        <FlagCard
          key={flag.id}
          flag={flag}
          busy={busy}
          onSelectField={onSelectField}
          onResolve={(action, justification) => onResolve(flag.id, action, justification)}
        />
      ))}
    </aside>
  );
}
