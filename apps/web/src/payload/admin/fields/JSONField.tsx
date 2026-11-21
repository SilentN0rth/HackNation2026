"use client";

import { Button, TextArea, TextField } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ClientField } from "payload";
import { useCallback, useEffect, useRef, useState } from "react";
import { FieldShell, PanelDescription, PanelError, PanelLabel } from "./shared/parts";
import { fieldId, usePanelField, type PanelFieldProps } from "./shared/usePanelField";
import { duration, ease } from "./motion";

type CodeClientField = ClientField & { admin?: { language?: string; editorOptions?: unknown } };

const stringify = (v: unknown) => (v === undefined || v === null ? "" : JSON.stringify(v, null, 2));

function parse(text: string): { ok: true; value: unknown } | { ok: false; error: string } {
  if (!text.trim()) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Niepoprawny JSON: ${msg}` };
  }
}

function summary(value: unknown) {
  if (Array.isArray(value)) return `tablica · ${value.length} el.`;
  if (value && typeof value === "object") return `obiekt · ${Object.keys(value).length} kl.`;
  if (value === null || value === undefined) return "puste";
  return typeof value;
}

/**
 * Edytor kodu (JSON lub tekst w danym języku): monospace JetBrains Mono, numer wierszy,
 * dla JSON – walidacja na żywo i blokada zapisu przy błędzie, zwijany panel.
 */
function CodeEditor({ mode, ...props }: PanelFieldProps & { mode: "json" | "code" }) {
  const field = props.field as CodeClientField;
  const localError = useRef<string | undefined>(undefined);
  const jsonValidate = useCallback(() => localError.current ?? true, []);
  const f = usePanelField<unknown>(props, mode === "json" ? jsonValidate : undefined);
  const reduce = useReducedMotion();
  const id = fieldId(f.path);
  const errorId = `${id}-error`;

  const external = mode === "json" ? stringify(f.value) : typeof f.value === "string" ? f.value : "";
  const [text, setText] = useState(external);
  const [parseError, setParseError] = useState<string>();
  const [openState, setOpen] = useState<boolean | null>(null);
  const lastSynced = useRef(external);

  // Zmiana wartości z zewnątrz (reset formularza, wczytanie wersji) – nadpisz tekst, jeśli to nie nasza edycja.
  useEffect(() => {
    if (external !== lastSynced.current) {
      lastSynced.current = external;
      setText(external);
      setParseError(undefined);
      localError.current = undefined;
    }
  }, [external]);

  const onChange = (next: string) => {
    setText(next);
    if (mode === "code") {
      lastSynced.current = next;
      f.setValue(next);
      return;
    }
    const result = parse(next);
    if (result.ok) {
      setParseError(undefined);
      localError.current = undefined;
      lastSynced.current = stringify(result.value);
      f.setValue(result.value);
    } else {
      setParseError(result.error);
      localError.current = result.error;
      // Oznacz formularz jako zmieniony, ale nie nadpisuj ostatniej poprawnej wartości.
      f.setValue(f.value);
    }
  };

  const format = () => {
    const result = parse(text);
    if (result.ok) setText(stringify(result.value));
  };

  const lines = Math.max(1, text.split("\n").length);
  const rows = Math.max(lines + 1, 6);
  // Domyślnie rozwinięty krótki, edytowalny JSON; długie schematy i pola tylko do odczytu – zwinięte.
  const open = openState ?? (!f.readOnly && lines <= 40);
  const shownError = parseError ?? f.error;
  const language = mode === "json" ? "JSON" : (field.admin?.language ?? "kod").toUpperCase();

  return (
    <FieldShell path={f.path} type={mode} style={f.style} className={f.className} invalid={Boolean(shownError)}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <PanelLabel htmlFor={id} required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
          <PanelDescription>{f.description}</PanelDescription>
        </div>
        <div className="flex items-center gap-2">
          <span className="pf-mono text-xs text-(--ink-3)">
            {language} · {mode === "json" ? summary(f.value) : `${lines} wiersz${lines === 1 ? "" : "y"}`}
          </span>
          {open && mode === "json" && !f.readOnly && (
            <Button size="sm" variant="ghost" onPress={format} isDisabled={Boolean(parseError)}>
              Formatuj
            </Button>
          )}
          <Button size="sm" variant="secondary" onPress={() => setOpen(!open)} aria-expanded={open} aria-controls={`${id}-panel`}>
            {open ? "Zwiń" : "Rozwiń"}
          </Button>
        </div>
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="editor"
            id={`${id}-panel`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : duration.base, ease }}
            className="overflow-hidden"
          >
            <TextField
              aria-label={f.label}
              value={text}
              onChange={onChange}
              isReadOnly={f.readOnly}
              isInvalid={Boolean(shownError)}
              validationBehavior="aria"
              className="pt-0.5"
            >
              <div className="relative flex max-h-[34rem] overflow-y-auto rounded-[6px]">
                <div aria-hidden className="pf-mono pointer-events-none absolute inset-y-0 left-0 w-10 select-none overflow-hidden rounded-l-[6px] border-r border-(--border) bg-(--surface-secondary) py-2 pr-2 text-right text-[0.8125rem] leading-[1.6] text-(--ink-3)">
                  {Array.from({ length: lines }, (_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <TextArea
                  id={id}
                  rows={rows}
                  spellCheck={false}
                  data-testid="json-editor"
                  aria-describedby={shownError ? errorId : undefined}
                  className="pf-mono w-full resize-none whitespace-pre py-2 pl-13 text-[0.8125rem] leading-[1.6]"
                  wrap="off"
                />
              </div>
            </TextField>
          </motion.div>
        )}
      </AnimatePresence>
      <PanelError id={errorId} message={shownError} />
    </FieldShell>
  );
}

export const JSONField = (props: PanelFieldProps) => <CodeEditor {...props} mode="json" />;
export const CodeField = (props: PanelFieldProps) => <CodeEditor {...props} mode="code" />;
