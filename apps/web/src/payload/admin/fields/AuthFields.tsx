"use client";

import { InputGroup, TextField } from "@heroui/react";
import { useField, useFormFields } from "@payloadcms/ui";
import type { Validate } from "payload";
import { useCallback, useState } from "react";
import { FieldShell, PanelError, PanelLabel } from "./shared/parts";
import { fieldId } from "./shared/usePanelField";

export function ConfirmPasswordField({ path = "confirm-password", passwordPath = "password", disabled }: { path?: string; passwordPath?: string; disabled?: boolean }) {
  const password = useFormFields(([fields]) => fields?.[passwordPath]?.value as string | undefined);
  const [reveal, setReveal] = useState(false);
  const validate = useCallback<Validate>(
    (value) => {
      if (!value) return "To pole jest wymagane.";
      return value === password ? true : "Hasła nie są takie same.";
    },
    [password],
  );
  const f = useField<string>({ path, validate, disableFormData: true });
  const id = fieldId(path);
  const error = f.showError ? f.errorMessage : undefined;
  return (
    <FieldShell path={path} type="confirm-password" invalid={Boolean(error)}>
      <TextField
        value={f.value ?? ""}
        onChange={(v) => f.setValue(v)}
        type={reveal ? "text" : "password"}
        isRequired
        isDisabled={disabled || f.disabled}
        isInvalid={Boolean(error)}
        validationBehavior="aria"
        className="flex flex-col gap-1.5"
      >
        <PanelLabel required>Powtórz hasło</PanelLabel>
        <InputGroup>
          <InputGroup.Input id={id} autoComplete="new-password" aria-describedby={error ? `${id}-error` : undefined} />
          <InputGroup.Suffix>
            <button type="button" onClick={() => setReveal((r) => !r)} className="pf-press px-1 text-sm font-semibold text-(--accent)" aria-pressed={reveal}>
              {reveal ? "Ukryj" : "Pokaż"}
            </button>
          </InputGroup.Suffix>
        </InputGroup>
      </TextField>
      <PanelError id={`${id}-error`} message={error} />
    </FieldShell>
  );
}
