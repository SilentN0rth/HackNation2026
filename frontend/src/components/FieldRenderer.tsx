"use client";

import {
  Checkbox,
  Description,
  Disclosure,
  FieldError,
  Input,
  Label,
  ListBox,
  Radio,
  RadioGroup,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import type { Field } from "@/types";

interface Props {
  field: Field;
  value: string | boolean | undefined;
  error?: string | null;
  prefilled?: boolean;
  onChange: (value: string | boolean) => void;
  /** Podgląd w edytorze urzędnika – pola nie da się wypełnić. */
  readOnly?: boolean;
}

const INPUT_TYPE: Partial<Record<Field["type"], string>> = { date: "date", email: "email", phone: "tel" };
const AUTOCOMPLETE: Partial<Record<Field["type"], string>> = {
  email: "email",
  phone: "tel",
  postalCode: "postal-code",
};

function FieldLabel({ field, prefilled }: { field: Field; prefilled?: boolean }) {
  return (
    <Label className="flex flex-wrap items-baseline gap-x-2 font-medium">
      {field.label}
      {!field.required && <span className="text-sm font-normal text-muted">(nieobowiązkowe)</span>}
      {prefilled && (
        <span className="text-sm font-normal text-success">✓ uzupełnione z {field.prefill?.source}</span>
      )}
    </Label>
  );
}

/** Renderuje jedno pole formularza obywatela razem z „Dlaczego pytamy?”. */
export function FieldRenderer({ field, value, error, prefilled, onChange, readOnly }: Props) {
  const str = typeof value === "string" ? value : "";
  const invalid = Boolean(error);
  const common = {
    name: field.id,
    isRequired: field.required,
    isInvalid: invalid,
    isReadOnly: readOnly,
    validationBehavior: "aria" as const,
  };
  const help = field.helpText && <Description>{field.helpText}</Description>;
  const err = <FieldError>{error}</FieldError>;

  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
      control = (
        <TextField {...common} value={str} onChange={onChange} className="flex flex-col gap-1.5">
          <FieldLabel field={field} prefilled={prefilled} />
          {help}
          <TextArea rows={4} placeholder={field.placeholder} />
          {err}
        </TextField>
      );
      break;

    case "select":
      control = (
        <Select
          {...common}
          value={str || null}
          onChange={(key) => onChange(key == null ? "" : String(key))}
          placeholder="— wybierz —"
          className="flex flex-col gap-1.5"
        >
          <FieldLabel field={field} prefilled={prefilled} />
          {help}
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          {err}
          <Select.Popover>
            <ListBox>
              {(field.options ?? []).map((o) => (
                <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
                  {o.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>
      );
      break;

    case "radio":
      control = (
        <RadioGroup {...common} value={str || null} onChange={onChange} className="flex flex-col gap-1.5">
          <FieldLabel field={field} prefilled={prefilled} />
          {help}
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {(field.options ?? []).map((o) => (
              <Radio key={o.value} value={o.value}>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Radio.Content>
                  <Label>{o.label}</Label>
                </Radio.Content>
              </Radio>
            ))}
          </div>
          {err}
        </RadioGroup>
      );
      break;

    case "textBlock":
    case "infoSection":
      control = (
        <div className={field.type === "infoSection" ? "rounded-lg bg-accent-soft/60 p-3" : undefined}>
          {field.label && <p className="font-medium">{field.label}</p>}
          {field.helpText && <p className="text-sm text-muted">{field.helpText}</p>}
        </div>
      );
      break;

    case "fileUpload": {
      const inputId = `file-${field.id}`;
      control = (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={inputId} className="flex flex-wrap items-baseline gap-x-2 font-medium">
            {field.label}
            {!field.required && <span className="text-sm font-normal text-muted">(nieobowiązkowe)</span>}
          </label>
          {field.helpText && <p className="text-sm text-muted">{field.helpText}</p>}
          <input
            id={inputId}
            name={field.id}
            type="file"
            disabled={readOnly}
            aria-invalid={invalid || undefined}
            aria-required={field.required}
            onChange={(e) => onChange(e.target.files?.[0]?.name ?? "")}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:py-2 file:font-medium file:text-accent-soft-foreground"
          />
          {str && <p className="text-sm text-muted">Wybrano: {str}</p>}
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      );
      break;
    }

    case "consent":
    case "checkbox":
      control = (
        <div className="flex flex-col gap-1.5">
          <Checkbox {...common} isSelected={value === true} onChange={onChange}>
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <FieldLabel field={field} prefilled={prefilled} />
              {help}
            </Checkbox.Content>
          </Checkbox>
          {error && (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      );
      break;

    default:
      control = (
        <TextField
          {...common}
          type={INPUT_TYPE[field.type] ?? "text"}
          value={str}
          onChange={onChange}
          autoComplete={AUTOCOMPLETE[field.type]}
          inputMode={["number", "pesel", "nip", "regon"].includes(field.type) ? "numeric" : undefined}
          className="flex flex-col gap-1.5"
        >
          <FieldLabel field={field} prefilled={prefilled} />
          {help}
          <Input placeholder={field.placeholder ?? (field.type === "postalCode" ? "00-000" : undefined)} />
          {err}
        </TextField>
      );
  }

  return (
    <div className="mb-6 flex flex-col gap-2">
      {control}
      {field.legalBasis && (
        <Disclosure className="rounded-lg bg-accent-soft/60">
          <Disclosure.Heading>
            <Disclosure.Trigger className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm font-medium text-accent-soft-foreground">
              Dlaczego o to pytamy?
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="px-3 pb-3">
              <blockquote className="border-l-4 border-accent pl-3 text-sm">
                „…{field.legalBasis.quote}…”
                <footer className="mt-1 text-muted">
                  {field.legalBasis.act}, {field.legalBasis.unit}
                </footer>
              </blockquote>
            </Disclosure.Body>
          </Disclosure.Content>
        </Disclosure>
      )}
    </div>
  );
}
