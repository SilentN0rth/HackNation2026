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
    <Card className={`border-l-4 ${BORDER[flag.severity]} ${handled ? "opacity-70" : ""}`}>
      <Card.Header className="gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={flag.severity} />
          <span className="text-xs text-muted">{LINTER_LABELS[flag.linter]}</span>
        </div>
        <Card.Title className={`text-base ${handled ? "line-through decoration-muted" : ""}`}>{flag.title}</Card.Title>
      </Card.Header>
      <Card.Content className="flex flex-col gap-2 text-sm">
        <p>{flag.message}</p>
        {flag.evidence && (
          <p className="rounded-md bg-default px-2 py-1.5 font-mono text-xs break-words text-muted">{flag.evidence}</p>
        )}
        {flag.suggestion && (
          <p className="text-muted">
            <strong className="text-foreground">Sugestia:</strong> {flag.suggestion}
          </p>
        )}
      </Card.Content>
      <Card.Footer className="flex-col items-stretch gap-2">
        {flag.resolution ? (
          <p className="text-sm text-muted" role="status">
            {flag.resolution.action === "fixed" ? "✔ Poprawione" : "✖ Odrzucone"} przez {flag.resolution.by}
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
              <Label>Dlaczego odrzucasz? (trafi do Audit Trail)</Label>
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
          <div className="flex flex-wrap gap-2">
            {flag.fieldId && onSelectField && (
              <Button size="sm" variant="tertiary" onPress={() => onSelectField(flag.fieldId!)}>
                Pokaż pole
              </Button>
            )}
            <Button size="sm" variant="secondary" isDisabled={busy} onPress={() => onResolve("fixed")}>
              Poprawione
            </Button>
            <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => setRejecting(true)}>
              Odrzuć z uzasadnieniem
            </Button>
          </div>
        )}
      </Card.Footer>
    </Card>
  );
}
