"use client";

import { useId, useState } from "react";
import {
  Checkbox,
  ComboBox,
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
import { citizenFileFormats, citizenFileHint, validateCitizenFile } from "@/lib/validators";
import type { Field } from "@/types";

interface Props {
  field: Field;
  value: string | boolean | undefined;
  error?: string | null;
  prefilled?: boolean;
  onChange: (value: string | boolean) => void;
  readOnly?: boolean;
  onUpload?: (file: File) => Promise<string>;
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
        <span className="text-sm font-normal text-success">dane z rejestru: {field.prefill?.source}</span>
      )}
    </Label>
  );
}

export function FieldRenderer({ field, value, error, prefilled, onChange, readOnly, onUpload }: Props) {
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const errorId = useId();
  const fileId = useId();
  const hintId = useId();
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

  const options = field.options ?? [];
  // Lista bez wartości (np. słownik, którego nie mamy) nie może blokować wymaganego pola – wpisujemy tekst.
  const kind = field.type === "select" && options.length === 0 ? "text" : field.type;
  // Standard: powyżej 15 opcji lista rozwijana ma wyszukiwarkę.
  const searchable = kind === "select" && options.length > 15;

  let control: React.ReactNode;
  switch (kind) {
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
      control = searchable ? (
        <ComboBox
          {...common}
          selectedKey={str || null}
          onSelectionChange={(key) => onChange(key == null ? "" : String(key))}
          menuTrigger="focus"
          className="flex flex-col gap-1.5"
        >
          <FieldLabel field={field} prefilled={prefilled} />
          {help}
          <ComboBox.InputGroup>
            <Input placeholder="Zacznij pisać, aby wyszukać" />
            <ComboBox.Trigger />
          </ComboBox.InputGroup>
          {err}
          <ComboBox.Popover>
            <ListBox renderEmptyState={() => <p className="px-3 py-2 text-sm text-muted">Brak wyników</p>}>
              {options.map((o) => (
                <ListBox.Item key={o.value} id={o.value} textValue={o.label}>
                  {o.label}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </ComboBox.Popover>
        </ComboBox>
      ) : (
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
              {options.map((o) => (
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
          <Checkbox
            {...common}
            isSelected={value === true}
            onChange={onChange}
            aria-describedby={error ? errorId : undefined}
          >
            <Checkbox.Control>
              <Checkbox.Indicator />
            </Checkbox.Control>
            <Checkbox.Content>
              <FieldLabel field={field} prefilled={prefilled} />
              {help}
            </Checkbox.Content>
          </Checkbox>
          {error && (
            <p id={errorId} className="text-sm text-danger" role="alert">
              {error}
            </p>
          )}
        </div>
      );
      break;

    case "file":
      control = (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fileId} className="font-medium">
            {field.label}
            {!field.required && <span className="ml-2 text-sm font-normal text-muted">(nieobowiązkowe)</span>}
          </label>
          {help}
          <p id={hintId} className="text-sm text-muted">
            {citizenFileHint(field)}
          </p>
          <input
            id={fileId}
            name={field.id}
            type="file"
            accept={citizenFileFormats(field).map((f) => `.${f}`).join(",")}
            required={field.required}
            disabled={readOnly || field.readOnly}
            aria-invalid={invalid}
            aria-describedby={error || uploadError ? `${hintId} ${errorId}` : hintId}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              setUploadError(null);
              if (!file) return onChange("");
              const fileError = validateCitizenFile(field, file);
              if (fileError) {
                e.target.value = "";
                onChange("");
                return setUploadError(fileError);
              }
              if (!onUpload) return onChange(file.name);
              setUploading(true);
              try {
                onChange(await onUpload(file));
              } catch (err) {
                e.target.value = "";
                setUploadError(err instanceof Error ? err.message : "Nie udało się wysłać pliku.");
              } finally {
                setUploading(false);
              }
            }}
            className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-accent-foreground"
          />
          {uploading && <p className="text-sm text-muted" role="status">Wysyłanie pliku…</p>}
          {str && !uploading && <p className="text-sm text-muted">Wybrany plik: {str.split("|").slice(1).join("|") || str}</p>}
          {(uploadError || error) && (
            <p id={errorId} className="text-sm text-danger" role="alert">
              {uploadError || error}
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

  // Nagłówek grupy pól z formularza: sam tekst, bez wartości do wpisania.
  if (field.type === "info") {
    return (
      <h3 className="mt-6 mb-3 border-b border-border pb-2 text-lg font-semibold text-ink first:mt-0">{field.label}</h3>
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
