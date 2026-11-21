"use client";

import { useCallback, useMemo } from "react";
import { getTranslation } from "@payloadcms/translations";
import { useField, useTranslation } from "@payloadcms/ui";
import type { ClientField, StaticDescription, StaticLabel, Validate } from "payload";

type AnyClientField = ClientField & {
  label?: StaticLabel | false;
  required?: boolean;
  admin?: { description?: StaticDescription; readOnly?: boolean; placeholder?: StaticLabel; width?: string; style?: React.CSSProperties; className?: string };
};

export type PanelFieldProps = {
  field: ClientField;
  path?: string;
  readOnly?: boolean;
};

/** Tłumaczy etykietę/opis Payloada (string albo { pl: … }) – niezależnie od lokalizacji. */
export function useText() {
  const { i18n } = useTranslation();
  return useCallback(
    (value: unknown): string | undefined => {
      if (value === false || value === undefined || value === null) return undefined;
      if (typeof value === "string") return value;
      if (typeof value === "object") return getTranslation(value as Record<string, string>, i18n) || undefined;
      return undefined;
    },
    [i18n],
  );
}

export const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/**
 * Wspólne spięcie z logiką pola Payloada: wartość, błędy z walidacji (klient + serwer), required,
 * readOnly (uprawnienia, admin.readOnly, blokada formularza), etykieta i opis.
 * `extraValidate` – walidacja kliencka uruchamiana przed zapisem (np. niepoprawny JSON).
 */
export function usePanelField<T = unknown>(props: PanelFieldProps, extraValidate?: (value: T) => string | true) {
  const field = props.field as AnyClientField;
  const text = useText();
  const { t } = useTranslation();
  const required = Boolean(field.required);

  const validate = useCallback<Validate>(
    (value) => {
      if (required && isEmpty(value)) return t("validation:required");
      return extraValidate ? extraValidate(value as T) : true;
    },
    [required, t, extraValidate],
  );

  const state = useField<T>({ potentiallyStalePath: props.path, validate });
  const readOnly = Boolean(props.readOnly || field.admin?.readOnly || state.disabled);

  const meta = useMemo(
    () => ({
      label: text(field.label) ?? ("name" in field ? String(field.name) : undefined),
      description: typeof field.admin?.description === "function" ? undefined : text(field.admin?.description),
      placeholder: text(field.admin?.placeholder),
      required,
      readOnly,
      style: { ...field.admin?.style, ...(field.admin?.width ? { flex: `0 1 ${field.admin.width}`, maxWidth: field.admin.width } : {}) },
      className: field.admin?.className,
    }),
    [field, text, required, readOnly],
  );

  const error = state.showError ? state.errorMessage || "Niepoprawna wartość." : undefined;
  return { ...state, ...meta, error, invalid: Boolean(error) };
}

/** id DOM pola – jak w Payloadzie (field-<ścieżka>), używane w testach i przez scrollToID Payloada. */
export const fieldId = (path: string) => `field-${path.replace(/\./g, "__")}`;
