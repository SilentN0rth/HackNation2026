"use client";


import { useState } from "react";
import { Button, Card, FieldError, Label, TextArea, TextField } from "@heroui/react";
import type { LintFlag } from "@/types";
import { LINTER_LABELS } from "@/types";
import { isHandled } from "@/lib/lint";
import { justificationSchema } from "@/lib/validators";
import { SeverityBadge } from "./Feedback";

interface Props {
  flag: LintFlag;
  busy?: boolean;
  onSelectField?: (fieldId: string) => void;
  onResolve: (action: "fixed" | "rejected", justification?: string) => void;
}

const BORDER: Record<LintFlag["severity"], string> = {
  error: "border-l-danger",
  warning: "border-l-warning",
  info: "border-l-accent",
};

export function FlagCard({ flag, busy, onSelectField, onResolve }: Props) {
  const [rejecting, setRejecting] = useState(false);
  const [justification, setJustification] = useState("");
  const [touched, setTouched] = useState(false);
  const handled = isHandled(flag);

  const parsed = justificationSchema.safeParse(justification);
  const justError = touched && !parsed.success ? parsed.error.issues[0]?.message : undefined;

  return (
    <Card className={`fade-in border-l-2 ${BORDER[flag.severity]} transition-opacity duration-200 ${handled ? "opacity-60" : ""}`}>
      <Card.Header className="gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={flag.severity} />
          <span className="text-xs text-ink-3">{LINTER_LABELS[flag.linter]}</span>
        </div>
        <Card.Title className={`text-base ${handled ? "line-through decoration-muted" : ""}`}>{flag.title}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-2 text-sm">
        <p>{flag.message}</p>
        {flag.evidence && (
          <p className="rounded-[4px] bg-default px-2.5 py-1.5 font-mono text-xs break-words text-ink-2">{flag.evidence}</p>
        )}
        {flag.suggestion && (
          <p className="text-muted">
            <strong className="text-foreground">Co zrobić:</strong> {flag.suggestion}
          </p>
        )}
      </Card.Content>
      <Card.Footer className="flex-col items-stretch gap-2">
        {flag.resolution ? (
          <p className="text-sm text-muted" role="status">
            {flag.resolution.action === "fixed" ? "Poprawione" : "Odrzucone"} przez {flag.resolution.by}
            {flag.resolution.justification && <> – „{flag.resolution.justification}”</>}
          </p>
        ) : rejecting ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setTouched(true);
              if (parsed.success) onResolve("rejected", parsed.data);
            }}
          >
            <TextField
              value={justification}
              onChange={setJustification}
              onBlur={() => setTouched(true)}
              isInvalid={Boolean(justError)}
              isRequired
              validationBehavior="aria"
              autoFocus
              className="flex flex-col gap-1"
            >
              <Label>Dlaczego odrzucasz tę uwagę? Uzasadnienie trafi do dziennika decyzji.</Label>
              <TextArea rows={2} />
              <FieldError>{justError}</FieldError>
            </TextField>
            <div className="flex gap-2">
              <Button type="submit" size="sm" variant="primary" isDisabled={busy}>
                Zapisz
              </Button>
              <Button size="sm" variant="ghost" onPress={() => setRejecting(false)}>
                Anuluj
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-sm font-semibold">
            {flag.fieldId && onSelectField && (
              <button type="button" className="press text-ink transition-colors duration-150 hover:text-accent" onClick={() => onSelectField(flag.fieldId!)}>
                Pokaż pole
              </button>
            )}
            <button type="button" disabled={busy} className="press text-accent transition-colors duration-150 hover:text-accent-hover disabled:opacity-50" onClick={() => onResolve("fixed")}>
              Poprawione
            </button>
            <button type="button" disabled={busy} className="press ml-auto text-ink-3 transition-colors duration-150 hover:text-ink disabled:opacity-50" onClick={() => setRejecting(true)}>
              Odrzuć
            </button>
          </div>
        )}
      </Card.Footer>
    </Card>
  );
}
