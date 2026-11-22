"use client";

import { useFormFields, useFormSubmitted } from "@payloadcms/ui";
import type { ClientField, StaticDescription, StaticLabel } from "payload";
import { PanelError } from "./shared/parts";
import { useText } from "./shared/usePanelField";
import "./fields.css";

type PartProps = { field?: ClientField & { label?: StaticLabel | false; required?: boolean; admin?: { description?: StaticDescription } }; path?: string; label?: StaticLabel; required?: boolean };

export function FieldLabel({ field, path, label, required }: PartProps) {
  const text = useText();
  const value = text(label ?? field?.label);
  if (!value) return null;
  const isRequired = required ?? field?.required;
  return (
    <label htmlFor={path ? `field-${path.replace(/\./g, "__")}` : undefined} className="pf-field ef-ui mb-1.5 flex flex-wrap items-baseline gap-x-2 text-[0.9375rem] font-medium text-(--ink)">
      {value}
      {!isRequired && <span className="text-sm font-normal text-(--ink-3)">(nieobowiązkowe)</span>}
    </label>
  );
}

export function FieldDescription({ field, description }: PartProps & { description?: StaticDescription }) {
  const text = useText();
  const value = typeof description === "function" ? undefined : text(description ?? (typeof field?.admin?.description === "function" ? undefined : field?.admin?.description));
  if (!value) return null;
  return <p className="pf-field ef-ui mt-1.5 text-sm leading-relaxed text-(--ink-3)">{value}</p>;
}

export function FieldError({ path, message, showError }: { path?: string; message?: string; showError?: boolean }) {
  const submitted = useFormSubmitted();
  const state = useFormFields(([fields]) => (path ? fields?.[path] : undefined));
  const visible = showError ?? (submitted && state?.valid === false);
  return (
    <div className="pf-field ef-ui">
      <PanelError message={visible ? (message ?? state?.errorMessage ?? "Niepoprawna wartość.") : undefined} />
    </div>
  );
}
