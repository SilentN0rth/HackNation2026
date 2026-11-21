"use client";

import { Input, ListBox, Radio, RadioGroup, Select, TextField, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import type { ClientField, Option } from "payload";
import { useMemo } from "react";
import { FieldShell, PanelDescription, PanelError, PanelLabel } from "./shared/parts";
import { fieldId, usePanelField, useText, type PanelFieldProps } from "./shared/usePanelField";

type OptionsField = ClientField & { options?: Option[]; hasMany?: boolean; admin?: { isClearable?: boolean; layout?: "horizontal" | "vertical" } };

function useOptions(field: OptionsField) {
  const text = useText();
  return useMemo(
    () => (field.options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o.value, label: text(o.label) ?? o.value })),
    [field.options, text],
  );
}

/** Pole tylko do odczytu: zamiast wyszarzonej kontrolki – czytelny tekst w polu readonly. */
export function ReadOnlyValue({ id, label, description, value }: { id: string; label?: string; description?: string; value: string }) {
  return (
    <TextField isReadOnly value={value} className="flex flex-col gap-1.5">
      <PanelLabel readOnly>{label}</PanelLabel>
      <PanelDescription>{description}</PanelDescription>
      <Input id={id} placeholder="—" />
    </TextField>
  );
}

/** Lista wyboru – HeroUI Select (pojedynczy lub wielokrotny wybór dla hasMany). */
export function SelectField(props: PanelFieldProps) {
  const field = props.field as OptionsField;
  const options = useOptions(field);
  const f = usePanelField<string | string[] | null>(props);
  const id = fieldId(f.path);
  const errorId = `${id}-error`;
  const multiple = Boolean(field.hasMany);
  const selected = multiple ? (Array.isArray(f.value) ? f.value : []) : typeof f.value === "string" ? f.value : null;

  if (f.readOnly) {
    const labels = (Array.isArray(selected) ? selected : selected ? [selected] : []).map((v) => options.find((o) => o.value === v)?.label ?? v);
    return (
      <FieldShell path={f.path} type="select" style={f.style} className={f.className}>
        <ReadOnlyValue id={id} label={f.label} description={f.description} value={labels.join(", ")} />
      </FieldShell>
    );
  }

  return (
    <FieldShell path={f.path} type="select" style={f.style} className={f.className} invalid={f.invalid}>
      <Select
        id={id}
        name={f.path}
        selectionMode={multiple ? "multiple" : "single"}
        value={selected as never}
        onChange={(key: unknown) => {
          if (multiple) f.setValue(Array.isArray(key) ? key.map(String) : []);
          else f.setValue(key == null ? null : String(key));
        }}
        placeholder="— wybierz —"
        isRequired={f.required}
        isInvalid={f.invalid}
        validationBehavior="aria"
        className="flex flex-col gap-1.5"
      >
        <PanelLabel required={f.required}>{f.label}</PanelLabel>
        <PanelDescription>{f.description}</PanelDescription>
        <Select.Trigger className="max-w-xl" aria-describedby={f.invalid ? errorId : undefined}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover className="pf-popover">
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
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}

/** Segmenty (HeroUI ToggleButtonGroup) – dla krótkich list, np. status formularza czy motyw. */
export function SegmentedSelectField(props: PanelFieldProps) {
  const field = props.field as OptionsField;
  const options = useOptions(field);
  const f = usePanelField<string | null>(props);
  const id = fieldId(f.path);
  const errorId = `${id}-error`;
  const value = typeof f.value === "string" ? f.value : null;

  return (
    <FieldShell path={f.path} type="segmented" style={f.style} className={f.className} invalid={f.invalid}>
      <PanelLabel elementType="span" required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
      <PanelDescription>{f.description}</PanelDescription>
      <ToggleButtonGroup
        data-field-id={id}
        aria-label={f.label}
        selectionMode="single"
        disallowEmptySelection={f.required}
        selectedKeys={value ? [value] : []}
        onSelectionChange={(keys) => {
          const [first] = [...keys];
          f.setValue(first == null ? null : String(first));
        }}
        isDisabled={f.readOnly}
        aria-describedby={f.invalid ? errorId : undefined}
        className="w-fit max-w-full flex-wrap"
        size="sm"
      >
        {options.map((o) => (
          <ToggleButton key={o.value} id={o.value} className="px-3">
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}

/** Pole radio – HeroUI RadioGroup. */
export function RadioField(props: PanelFieldProps) {
  const field = props.field as OptionsField;
  const options = useOptions(field);
  const f = usePanelField<string | null>(props);
  const id = fieldId(f.path);
  const errorId = `${id}-error`;
  const vertical = field.admin?.layout === "vertical";

  return (
    <FieldShell path={f.path} type="radio" style={f.style} className={f.className} invalid={f.invalid}>
      <RadioGroup
        id={id}
        name={f.path}
        value={typeof f.value === "string" ? f.value : null}
        onChange={(v) => f.setValue(v)}
        isRequired={f.required}
        isReadOnly={f.readOnly}
        isInvalid={f.invalid}
        validationBehavior="aria"
        aria-describedby={f.invalid ? errorId : undefined}
        className="flex flex-col gap-1.5"
      >
        <PanelLabel required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
        <PanelDescription>{f.description}</PanelDescription>
        <div className={vertical ? "flex flex-col gap-2" : "flex flex-wrap gap-x-6 gap-y-2"}>
          {options.map((o) => (
            <Radio key={o.value} value={o.value}>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Radio.Content>{o.label}</Radio.Content>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}
