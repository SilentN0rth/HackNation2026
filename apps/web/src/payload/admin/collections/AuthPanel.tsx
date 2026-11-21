"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { useField, useFormFields } from "@payloadcms/ui";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { duration, ease } from "./motion";
import { SectionLabel } from "./ui";

/** Hasło konta (kolekcja auth) – zastępuje natywny panel Auth Payloada. Pola formularza: password, confirm-password. */
export function AuthPanel({ isCreate, readOnly }: { isCreate: boolean; readOnly: boolean }) {
  const [open, setOpen] = useState(isCreate);
  return (
    <section className="flex flex-col gap-4" data-testid="auth-panel">
      <SectionLabel>Hasło</SectionLabel>
      {!open ? (
        <div className="flex items-center justify-between gap-4 border-y border-border py-4">
          <p className="text-muted">Hasło jest ustawione.</p>
          <Button variant="secondary" size="sm" isDisabled={readOnly} onPress={() => setOpen(true)}>
            Zmień hasło
          </Button>
        </div>
      ) : (
        <AnimatePresence initial={false}>
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: duration.base, ease }} className="grid gap-5 sm:grid-cols-2">
            <PasswordInputs required={isCreate} />
            {!isCreate && (
              <div className="sm:col-span-2">
                <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
                  Anuluj zmianę hasła
                </Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </section>
  );
}

function PasswordInputs({ required }: { required: boolean }) {
  const password = useField<string>({
    path: "password",
    validate: (v) => (required && !v ? "Podaj hasło." : v && String(v).length < 3 ? "Hasło jest za krótkie." : true),
  });
  const passwordValue = useFormFields(([fields]) => fields?.password?.value as string | undefined);
  const confirm = useField<string>({
    path: "confirm-password",
    validate: (v) => (passwordValue && v !== passwordValue ? "Hasła nie są takie same." : true),
  });
  return (
    <>
      <TextField
        type="password"
        value={password.value ?? ""}
        onChange={(v) => password.setValue(v)}
        isInvalid={password.showError}
        isRequired={required}
        className="flex flex-col gap-1.5"
      >
        <Label>Nowe hasło</Label>
        <Input autoComplete="new-password" data-testid="field-password" />
        <FieldError>{password.errorMessage}</FieldError>
      </TextField>
      <TextField
        type="password"
        value={confirm.value ?? ""}
        onChange={(v) => confirm.setValue(v)}
        isInvalid={confirm.showError}
        isRequired={required}
        className="flex flex-col gap-1.5"
      >
        <Label>Powtórz hasło</Label>
        <Input autoComplete="new-password" data-testid="field-confirm-password" />
        <FieldError>{confirm.errorMessage}</FieldError>
      </TextField>
    </>
  );
}
