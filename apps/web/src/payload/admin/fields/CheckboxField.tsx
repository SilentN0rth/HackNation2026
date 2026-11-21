"use client";

import { Checkbox, Switch } from "@heroui/react";
import { FieldShell, PanelDescription, PanelError } from "./shared/parts";
import { fieldId, usePanelField, type PanelFieldProps } from "./shared/usePanelField";

/** Pole wyboru – HeroUI Checkbox z etykietą i opisem obok kontrolki. */
export function CheckboxField(props: PanelFieldProps) {
  const f = usePanelField<boolean | null>(props);
  const id = fieldId(f.path);
  const errorId = `${id}-error`;
  return (
    <FieldShell path={f.path} type="checkbox" style={f.style} className={f.className} invalid={f.invalid}>
      <Checkbox
        id={id}
        name={f.path}
        isSelected={f.value === true}
        onChange={(v) => f.setValue(v)}
        isReadOnly={f.readOnly}
        isInvalid={f.invalid}
        validationBehavior="aria"
        aria-describedby={f.invalid ? errorId : undefined}
      >
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
        <Checkbox.Content>
          <span className="text-[0.9375rem] font-medium text-(--ink)">{f.label}</span>
          <PanelDescription>{f.description}</PanelDescription>
        </Checkbox.Content>
      </Checkbox>
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}

/** Przełącznik – HeroUI Switch, dla ustawień typu włącz/wyłącz (np. settings.animations). */
export function SwitchField(props: PanelFieldProps) {
  const f = usePanelField<boolean | null>(props);
  const id = fieldId(f.path);
  return (
    <FieldShell path={f.path} type="switch" style={f.style} className={f.className} invalid={f.invalid}>
      <Switch id={id} name={f.path} isSelected={f.value === true} onChange={(v) => f.setValue(v)} isReadOnly={f.readOnly}>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Content>
          <span className="text-[0.9375rem] font-medium text-(--ink)">{f.label}</span>
          <PanelDescription>{f.description}</PanelDescription>
        </Switch.Content>
      </Switch>
      <PanelError message={f.error} />
    </FieldShell>
  );
}
