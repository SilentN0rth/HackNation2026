"use client";

import { Input, InputGroup, TextArea, TextField as HeroTextField } from "@heroui/react";
import type { ClientField } from "payload";
import { useState } from "react";
import { FieldShell, PanelDescription, PanelError, PanelLabel } from "./shared/parts";
import { fieldId, usePanelField, type PanelFieldProps } from "./shared/usePanelField";

type TextLikeField = ClientField & { minLength?: number; maxLength?: number; admin?: { autoComplete?: string; rows?: number } };

type Variant = "text" | "email" | "textarea" | "password";

function TextLike({ variant, ...props }: PanelFieldProps & { variant: Variant }) {
  const field = props.field as TextLikeField;
  const f = usePanelField<string>(props);
  const [reveal, setReveal] = useState(false);
  const id = fieldId(f.path);
  const errorId = `${id}-error`;
  const value = typeof f.value === "string" ? f.value : f.value == null ? "" : String(f.value);
  const common = {
    name: f.path,
    value,
    onChange: (v: string) => f.setValue(v),
    isRequired: f.required,
    isReadOnly: f.readOnly,
    isInvalid: f.invalid,
    validationBehavior: "aria" as const,
    maxLength: field.maxLength,
    className: "flex flex-col gap-1.5",
  };

  return (
    <FieldShell path={f.path} type={variant} style={f.style} className={f.className} invalid={f.invalid}>
      {variant === "textarea" ? (
        <HeroTextField {...common}>
          <PanelLabel required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
          <PanelDescription>{f.description}</PanelDescription>
          <TextArea id={id} rows={field.admin?.rows ?? 4} placeholder={f.placeholder} aria-describedby={f.invalid ? errorId : undefined} className="min-h-24 resize-y leading-relaxed" />
        </HeroTextField>
      ) : variant === "password" ? (
        <HeroTextField {...common} type={reveal ? "text" : "password"}>
          <PanelLabel required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
          <PanelDescription>{f.description}</PanelDescription>
          <InputGroup>
            <InputGroup.Input id={id} autoComplete={field.admin?.autoComplete ?? "new-password"} aria-describedby={f.invalid ? errorId : undefined} />
            <InputGroup.Suffix>
              <button type="button" onClick={() => setReveal((r) => !r)} className="pf-press px-1 text-sm font-semibold text-(--accent)" aria-pressed={reveal}>
                {reveal ? "Ukryj" : "Pokaż"}
              </button>
            </InputGroup.Suffix>
          </InputGroup>
        </HeroTextField>
      ) : (
        <HeroTextField {...common} type={variant === "email" ? "email" : "text"}>
          <PanelLabel required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
          <PanelDescription>{f.description}</PanelDescription>
          <Input
            id={id}
            placeholder={f.placeholder}
            autoComplete={field.admin?.autoComplete ?? (variant === "email" ? "email" : undefined)}
            aria-describedby={f.invalid ? errorId : undefined}
          />
        </HeroTextField>
      )}
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}

export const TextField = (props: PanelFieldProps) => <TextLike {...props} variant="text" />;
export const EmailField = (props: PanelFieldProps) => <TextLike {...props} variant="email" />;
export const TextareaField = (props: PanelFieldProps) => <TextLike {...props} variant="textarea" />;
export const PasswordField = (props: PanelFieldProps) => <TextLike {...props} variant="password" />;
