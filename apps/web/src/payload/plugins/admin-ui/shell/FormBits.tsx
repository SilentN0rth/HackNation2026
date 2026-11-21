"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";

type InputProps = {
  name: string;
  label: string;
  type?: ComponentProps<typeof Input>["type"];
  autoComplete?: string;
  required?: boolean;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: ReactNode;
  autoFocus?: boolean;
  maxLength?: number;
  /** id inputa – na ekranie logowania zgodne z Payloadem (#field-email), z którego korzystają testy e2e. */
  inputId?: string;
};

/** Pole tekstowe w stylu formularzy obywatela (FieldRenderer). */
export function TextInput({ name, label, type = "text", required, error, hint, value, onChange, autoComplete, autoFocus, maxLength, inputId }: InputProps) {
  return (
    <TextField
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      isRequired={required}
      isInvalid={Boolean(error)}
      validationBehavior="aria"
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      maxLength={maxLength}
      className="flex flex-col gap-1.5"
    >
      <Label className="flex flex-wrap items-baseline gap-x-2 font-medium">
        {label}
        {!required && <span className="text-sm font-normal text-muted">(nieobowiązkowe)</span>}
      </Label>
      {hint && <p className="text-sm text-ink-3">{hint}</p>}
      <Input id={inputId} className="h-11" />
      <FieldError>{error}</FieldError>
    </TextField>
  );
}

/** Komunikat błędu całego formularza – ogłaszany czytnikom ekranu. */
export function FormAlert({ message, tone = "danger" }: { message?: string | null; tone?: "danger" | "success" }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.p
          role={tone === "danger" ? "alert" : "status"}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className={`rounded-md px-4 py-3 text-sm ${
            tone === "danger" ? "bg-danger-soft text-danger-soft-foreground" : "bg-success-soft text-success-soft-foreground"
          }`}
        >
          {message}
        </motion.p>
      )}
    </AnimatePresence>
  );
}

export function SubmitButton({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <Button type="submit" variant="primary" isPending={busy} className="h-11 w-full px-5 text-[15px] sm:w-auto">
      {children}
    </Button>
  );
}
