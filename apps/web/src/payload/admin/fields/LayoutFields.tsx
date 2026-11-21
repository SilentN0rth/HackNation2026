"use client";

import { Button, Tabs } from "@heroui/react";
import { RenderFields, useField, useForm, useFormFields, useFormSubmitted } from "@payloadcms/ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ClientField, SanitizedFieldPermissions, StaticLabel } from "payload";
import { getFieldPaths } from "payload/shared";
import { useId, useMemo, useState, type ReactNode } from "react";
import { PanelDescription, PanelError } from "./shared/parts";
import { fieldId, useText } from "./shared/usePanelField";
import { duration, ease } from "./motion";

type Perms = SanitizedFieldPermissions | boolean | undefined;
type LayoutProps = {
  field: ClientField;
  path?: string;
  schemaPath?: string;
  indexPath?: string;
  parentPath?: string;
  parentSchemaPath?: string;
  permissions?: Perms;
  readOnly?: boolean;
};
type WithFields = ClientField & {
  name?: string;
  label?: StaticLabel | false;
  fields: ClientField[];
  admin?: { description?: unknown; initCollapsed?: boolean; readOnly?: boolean; hideGutter?: boolean };
};

const childPerms = (p: Perms) => (p === true || p === false || p === undefined ? p : ((p as { fields?: Perms }).fields ?? p)) as never;

/** Liczba błędów w polach pod daną ścieżką – do znaczników przy grupach, zakładkach i wierszach. */
function useErrorCount(prefix: string) {
  const submitted = useFormSubmitted();
  return useFormFields(([fields]) =>
    submitted ? Object.entries(fields).filter(([p, s]) => (prefix === "" || p === prefix || p.startsWith(`${prefix}.`)) && s.valid === false).length : 0,
  );
}

function ErrorBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-(--danger) px-1.5 text-xs font-semibold text-white" aria-label={`Błędy: ${count}`}>
      {count}
    </span>
  );
}

/** Nagłówek sekcji jak na stronie głównej: border-t border-ink, semibold, ciasny tracking. */
function SectionHeading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-(--ink) pt-3">
      <h3 className="m-0 text-lg font-semibold tracking-[-0.02em] text-(--ink)">{children}</h3>
      {aside}
    </div>
  );
}

/** Grupa – nagłówek sekcji i pola zagnieżdżone (nazwana grupa tworzy obiekt w danych). */
export function GroupField(props: LayoutProps) {
  const field = props.field as WithFields;
  const text = useText();
  const path = props.path ?? "";
  const named = Boolean(field.name);
  const label = text(field.label);
  const errors = useErrorCount(named ? path : "__none__");
  return (
    <section className="field-type pf-field ef-ui flex flex-col gap-4" data-pf-field="group" data-path={path} id={fieldId(path)}>
      {label && <SectionHeading aside={<ErrorBadge count={errors} />}>{label}</SectionHeading>}
      <PanelDescription>{text(field.admin?.description)}</PanelDescription>
      <RenderFields
        fields={field.fields}
        margins="small"
        parentIndexPath={named ? "" : (props.indexPath ?? "")}
        parentPath={named ? path : (props.parentPath ?? "")}
        parentSchemaPath={named ? (props.schemaPath ?? "") : (props.parentSchemaPath ?? "")}
        permissions={named ? childPerms(props.permissions) : (props.permissions as never)}
        readOnly={props.readOnly || field.admin?.readOnly}
      />
    </section>
  );
}

/** Wiersz – pola obok siebie (na telefonie jedno pod drugim). */
export function RowField(props: LayoutProps) {
  const field = props.field as WithFields;
  return (
    <div className="field-type pf-field ef-ui" data-pf-field="row">
      <RenderFields
        className="flex flex-col gap-4 md:flex-row md:[&>*]:min-w-0 md:[&>*]:flex-1 [&>.pf-field]:!mb-0"
        fields={field.fields}
        margins={false}
        parentIndexPath={props.indexPath ?? ""}
        parentPath={props.parentPath ?? ""}
        parentSchemaPath={props.parentSchemaPath ?? ""}
        permissions={props.permissions as never}
        readOnly={props.readOnly}
      />
    </div>
  );
}

/** Sekcja zwijana – nagłówek z przyciskiem, treść wysuwana animacją wysokości. */
export function CollapsibleField(props: LayoutProps) {
  const field = props.field as WithFields;
  const text = useText();
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(!field.admin?.initCollapsed);
  const panelId = useId();
  const label = text(field.label) ?? "Szczegóły";
  return (
    <section className="field-type pf-field ef-ui flex flex-col gap-3" data-pf-field="collapsible">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center justify-between gap-3 border-t border-(--ink) pt-3 text-left"
      >
        <span className="text-lg font-semibold tracking-[-0.02em] text-(--ink)">{label}</span>
        <motion.svg aria-hidden viewBox="0 0 16 16" className="size-4 text-(--ink-3)" animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduce ? 0 : duration.base, ease }}>
          <path d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </motion.svg>
      </button>
      <PanelDescription>{text(field.admin?.description)}</PanelDescription>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={panelId}
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : duration.base, ease }}
            className="overflow-hidden"
          >
            <div className="pt-1">
              <RenderFields
                fields={field.fields}
                margins="small"
                parentIndexPath={props.indexPath ?? ""}
                parentPath={props.parentPath ?? ""}
                parentSchemaPath={props.parentSchemaPath ?? ""}
                permissions={props.permissions as never}
                readOnly={props.readOnly}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

type TabConfig = { name?: string; label?: StaticLabel; fields: ClientField[]; description?: unknown; admin?: { description?: unknown } };

function TabLabel({ tab, parentPath, index }: { tab: TabConfig; parentPath: string; index: number }) {
  const text = useText();
  const errors = useErrorCount(tab.name ? (parentPath ? `${parentPath}.${tab.name}` : tab.name) : "__none__");
  return (
    <span className="inline-flex items-center gap-2">
      {text(tab.label) ?? tab.name ?? `Zakładka ${index + 1}`}
      <ErrorBadge count={errors} />
    </span>
  );
}

/** Zakładki – HeroUI Tabs (podkreślenie w kolorze akcentu jak na stronie głównej). */
export function TabsField(props: LayoutProps) {
  const field = props.field as ClientField & { tabs: TabConfig[] };
  const text = useText();
  const reduce = useReducedMotion();
  const [active, setActive] = useState("0");
  const path = props.path ?? "";
  const tabs = field.tabs;
  const current = Number(active);
  const tab = tabs[current];
  const paths = useMemo(
    () =>
      tab
        ? getFieldPaths({
            field: { ...tab, type: "tab" } as never,
            index: current,
            parentIndexPath: props.indexPath ?? "",
            parentPath: path,
            parentSchemaPath: props.schemaPath ?? "",
          })
        : null,
    [tab, current, props.indexPath, path, props.schemaPath],
  );
  const perms =
    tab?.name && props.permissions && typeof props.permissions === "object"
      ? childPerms((props.permissions as unknown as Record<string, Perms>)[tab.name])
      : (props.permissions as never);

  return (
    <div className="field-type pf-field ef-ui flex flex-col gap-5" data-pf-field="tabs">
      <Tabs selectedKey={active} onSelectionChange={(k) => setActive(String(k))}>
        <Tabs.ListContainer>
          <Tabs.List aria-label="Sekcje">
            {tabs.map((t, i) => (
              <Tabs.Tab key={i} id={String(i)} className="pb-2 text-[0.9375rem] font-semibold">
                <TabLabel tab={t} parentPath={path} index={i} />
                <Tabs.Indicator />
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs.ListContainer>
      </Tabs>
      <AnimatePresence mode="wait" initial={false}>
        {tab && paths && (
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: reduce ? 0 : duration.base, ease }}
            className="flex flex-col gap-4"
            role="tabpanel"
          >
            <PanelDescription>{text(tab.description ?? tab.admin?.description)}</PanelDescription>
            <RenderFields
              fields={tab.fields}
              parentIndexPath={paths.indexPath}
              parentPath={paths.path}
              parentSchemaPath={paths.schemaPath}
              permissions={perms}
              readOnly={props.readOnly}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type ArrayClientField = WithFields & { labels?: { singular?: StaticLabel; plural?: StaticLabel }; minRows?: number; maxRows?: number; required?: boolean };

/** Tablica – wiersze z dodawaniem, usuwaniem i zmianą kolejności (logika wierszy z formularza Payloada). */
export function ArrayField(props: LayoutProps) {
  const field = props.field as ArrayClientField;
  const text = useText();
  const reduce = useReducedMotion();
  const { addFieldRow, removeFieldRow, moveFieldRow } = useForm();
  const { path, rows = [], showError, errorMessage, disabled } = useField({ hasRows: true, potentiallyStalePath: props.path });
  const schemaPath = props.schemaPath ?? "";
  const readOnly = Boolean(props.readOnly || field.admin?.readOnly || disabled);
  const singular = text(field.labels?.singular) ?? "Wiersz";
  const label = text(field.label) ?? text(field.labels?.plural);
  const canAdd = !readOnly && !(field.maxRows && rows.length >= field.maxRows);
  const errors = useErrorCount(path);

  const add = (rowIndex: number) => addFieldRow({ path, rowIndex, schemaPath });
  const remove = (rowIndex: number) => removeFieldRow({ path, rowIndex });
  const move = (from: number, to: number) => moveFieldRow({ moveFromIndex: from, moveToIndex: to, path });

  return (
    <section className="field-type pf-field ef-ui flex flex-col gap-3" data-pf-field="array" data-path={path} id={fieldId(path)}>
      <SectionHeading
        aside={
          <span className="flex items-center gap-2">
            <ErrorBadge count={errors} />
            <span className="pf-mono text-xs text-(--ink-3)">{rows.length}</span>
          </span>
        }
      >
        {label}
      </SectionHeading>
      <PanelDescription>{text(field.admin?.description)}</PanelDescription>
      <motion.ol layout className="m-0 flex list-none flex-col gap-3 p-0">
        <AnimatePresence initial={false}>
          {rows.map((row, i) => {
            const rowPath = `${path}.${i}`;
            return (
              <motion.li
                key={row.id}
                layout={reduce ? false : "position"}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: reduce ? 0 : duration.base, ease }}
                className="overflow-hidden"
                data-testid="array-row"
              >
                <div className="rounded-[10px] border border-(--border) p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold uppercase text-(--accent)">
                      {singular} <span className="pf-mono">{String(i + 1).padStart(2, "0")}</span>
                    </span>
                    {!readOnly && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Przenieś wyżej: ${singular} ${i + 1}`} isDisabled={i === 0} onPress={() => move(i, i - 1)}>
                          <svg aria-hidden viewBox="0 0 16 16" className="size-4"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                        </Button>
                        <Button size="sm" variant="ghost" isIconOnly aria-label={`Przenieś niżej: ${singular} ${i + 1}`} isDisabled={i === rows.length - 1} onPress={() => move(i, i + 1)}>
                          <svg aria-hidden viewBox="0 0 16 16" className="size-4"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
                        </Button>
                        <Button size="sm" variant="ghost" aria-label={`Usuń: ${singular} ${i + 1}`} onPress={() => remove(i)} className="text-(--danger)">
                          Usuń
                        </Button>
                      </div>
                    )}
                  </div>
                  <RenderFields
                    fields={field.fields}
                    margins="small"
                    parentIndexPath=""
                    parentPath={rowPath}
                    parentSchemaPath={schemaPath}
                    permissions={childPerms(props.permissions)}
                    readOnly={readOnly}
                  />
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ol>
      {rows.length === 0 && <p className="text-sm text-(--ink-3)">Brak pozycji.</p>}
      {canAdd && (
        <div>
          <Button size="sm" variant="secondary" onPress={() => add(rows.length)}>
            + Dodaj: {singular.toLowerCase()}
          </Button>
        </div>
      )}
      <PanelError message={showError ? errorMessage : undefined} />
    </section>
  );
}
