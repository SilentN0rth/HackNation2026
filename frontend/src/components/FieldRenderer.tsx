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
        <span className="text-sm font-normal text-success">pobrane z {field.prefill?.source}</span>
      )}
    </Label>
  );
}

export function FieldRenderer({ field, value, error, prefilled, onChange, readOnly }: Props) {
  const str = typeof value === "string" ? value : "";
  const invalid = Boolean(error);
  const common = {
    name: field.id,
    isRequired: field.required,
    isInvalid: invalid,
    isReadOnly: readOnly || field.readOnly,
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
          inputMode={field.type === "number" || field.type === "pesel" ? "numeric" : undefined}
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
        <Disclosure className="-mt-0.5">
          <Disclosure.Heading>
            <Disclosure.Trigger className="inline-flex w-auto items-center gap-1 text-[13px] font-medium text-ink-3 transition-colors duration-150 hover:text-accent">
              Dlaczego o to pytamy?
              <Disclosure.Indicator />
            </Disclosure.Trigger>
          </Disclosure.Heading>
          <Disclosure.Content>
            <Disclosure.Body className="mt-2 border-l-2 border-accent pl-3">
              <blockquote className="text-sm leading-relaxed text-ink-2">
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
