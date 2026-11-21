"use client";

import { NumberField as HeroNumberField } from "@heroui/react";
import type { ClientField } from "payload";
import { useCallback } from "react";
import { FieldShell, PanelDescription, PanelError, PanelLabel } from "./shared/parts";
import { fieldId, usePanelField, type PanelFieldProps } from "./shared/usePanelField";

type NumberClientField = ClientField & { min?: number; max?: number; admin?: { step?: number } };

/** Liczba – HeroUI NumberField (stepper, polski format), cyfry w JetBrains Mono. */
export function NumberField(props: PanelFieldProps) {
  const field = props.field as NumberClientField;
  const { min, max } = field;
  const validateRange = useCallback(
    (v: number | null | undefined) => {
      if (v == null) return true;
      if (min != null && v < min) return `Wartość musi być co najmniej ${min}.`;
      if (max != null && v > max) return `Wartość może wynosić najwyżej ${max}.`;
      return true;
    },
    [min, max],
  );
  const f = usePanelField<number | null>(props, validateRange);
  const id = fieldId(f.path);
  const errorId = `${id}-error`;

  return (
    <FieldShell path={f.path} type="number" style={f.style} className={f.className} invalid={f.invalid}>
      <HeroNumberField
        name={f.path}
        value={typeof f.value === "number" ? f.value : Number.NaN}
        onChange={(v) => f.setValue(Number.isNaN(v) ? null : v)}
        minValue={min}
        maxValue={max}
        step={field.admin?.step}
        isRequired={f.required}
        isReadOnly={f.readOnly}
        isInvalid={f.invalid}
        validationBehavior="aria"
        formatOptions={{ useGrouping: false, maximumFractionDigits: 6 }}
        className="flex flex-col gap-1.5"
      >
        <PanelLabel required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
        <PanelDescription>{f.description}</PanelDescription>
        <HeroNumberField.Group className="max-w-56">
          {!f.readOnly && <HeroNumberField.DecrementButton aria-label="Zmniejsz" />}
          <HeroNumberField.Input id={id} className="pf-mono" placeholder={f.placeholder} aria-describedby={f.invalid ? errorId : undefined} />
          {!f.readOnly && <HeroNumberField.IncrementButton aria-label="Zwiększ" />}
        </HeroNumberField.Group>
      </HeroNumberField>
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}

/** Punkt geograficzny [długość, szerokość] – dwa pola liczbowe. */
export function PointField(props: PanelFieldProps) {
  const f = usePanelField<[number, number] | null>(props);
  const id = fieldId(f.path);
  const value = Array.isArray(f.value) ? f.value : [Number.NaN, Number.NaN];
  const set = (i: 0 | 1, v: number) => {
    const next: [number, number] = [value[0] ?? Number.NaN, value[1] ?? Number.NaN];
    next[i] = v;
    f.setValue(next.every((n) => Number.isNaN(n)) ? null : next.map((n) => (Number.isNaN(n) ? 0 : n)));
  };
  return (
    <FieldShell path={f.path} type="point" style={f.style} className={f.className} invalid={f.invalid}>
      <PanelLabel elementType="span" required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
      <PanelDescription>{f.description}</PanelDescription>
      <div className="grid grid-cols-2 gap-3">
        {(["Długość", "Szerokość"] as const).map((label, i) => (
          <HeroNumberField key={label} value={value[i] ?? Number.NaN} onChange={(v) => set(i as 0 | 1, v)} isReadOnly={f.readOnly} isInvalid={f.invalid} formatOptions={{ maximumFractionDigits: 8 }} className="flex flex-col gap-1">
            <span className="text-sm text-(--ink-3)">{label}</span>
            <HeroNumberField.Group>
              <HeroNumberField.Input id={`${id}-${i}`} aria-label={label} className="pf-mono" />
            </HeroNumberField.Group>
          </HeroNumberField>
        ))}
      </div>
      <PanelError message={f.error} />
    </FieldShell>
  );
}
