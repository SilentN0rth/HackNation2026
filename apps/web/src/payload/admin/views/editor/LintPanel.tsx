"use client";

import { Button, Card } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { canPublish, countOpen, sortFlags } from "@/lib/lint";
import type { LintFlag } from "@/types";
import { ease } from "../motion";
import { OpenFlags } from "../ui/bits";
import { FlagCard } from "./FlagCard";

interface Props {
  flags: LintFlag[];
  busy: boolean;
  linting: boolean;
  canLint: boolean;
  onLint: () => void;
  onSelectField: (fieldId: string) => void;
  onResolve: (flagId: string, action: "fixed" | "rejected", justification?: string) => void;
}

/** Panel kontroli jakości: liczniki, ponowne uruchomienie linterów i karty uwag (przestawiają się płynnie po rozstrzygnięciu). */
export function LintPanel({ flags, busy, linting, canLint, onLint, onSelectField, onResolve }: Props) {
  const reduce = useReducedMotion();
  const open = countOpen(flags);
  return (
    <aside aria-label="Kontrola jakości" data-testid="lint-panel" className="flex flex-col gap-3">
      <Card>
        <Card.Header className="flex-row items-center justify-between gap-3">
          <Card.Title className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Kontrola jakości</Card.Title>
          <Button size="sm" variant="secondary" isPending={linting} isDisabled={busy || !canLint} onPress={onLint}>
            Uruchom
          </Button>
        </Card.Header>
        <Card.Content className="flex flex-col gap-3">
          <OpenFlags errors={open.errors} warnings={open.warnings} infos={open.infos} showZero />
          <p id="publish-hint" className="m-0 text-sm text-ink-3" aria-live="polite">
            {canPublish(flags)
              ? "Wszystkie krytyczne uwagi są obsłużone. Możesz opublikować formularz."
              : "Opublikujesz formularz, gdy obsłużysz wszystkie krytyczne uwagi."}
          </p>
        </Card.Content>
      </Card>
      <AnimatePresence initial={false}>
        {sortFlags(flags).map((flag) => (
          <motion.div
            key={flag.id}
            layout={!reduce}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.35, ease }}
          >
            <FlagCard
              flag={flag}
              busy={busy}
              onSelectField={onSelectField}
              onResolve={(action, justification) => onResolve(flag.id, action, justification)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </aside>
  );
}
