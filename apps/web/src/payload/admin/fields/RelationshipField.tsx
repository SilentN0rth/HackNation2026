"use client";

import { Chip, CloseButton, ComboBox, Input, ListBox, Spinner } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import type { ClientField } from "payload";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReadOnlyValue } from "./SelectField";
import { docTitle, usePayloadApi, type DocLike } from "./shared/api";
import { FieldShell, PanelDescription, PanelError, PanelLabel } from "./shared/parts";
import { fieldId, usePanelField, type PanelFieldProps } from "./shared/usePanelField";
import { useFieldMotion } from "./shared/useFieldMotion";

type RelClientField = ClientField & { relationTo: string | string[]; hasMany?: boolean };
type Id = string | number;
type PolyValue = { relationTo: string; value: Id };
type Ref = { slug: string; id: Id };
type Option = Ref & { key: string; label: string };

const keyOf = (r: Ref) => `${r.slug}::${r.id}`;

function toRefs(value: unknown, slugs: string[], poly: boolean): Ref[] {
  const list = Array.isArray(value) ? value : value == null || value === "" ? [] : [value];
  return list.flatMap((v): Ref[] => {
    if (poly && v && typeof v === "object" && "relationTo" in v) {
      const p = v as PolyValue;
      const id = typeof p.value === "object" && p.value ? (p.value as DocLike).id : p.value;
      return [{ slug: p.relationTo, id }];
    }
    if (v && typeof v === "object" && "id" in v) return [{ slug: slugs[0]!, id: (v as DocLike).id }];
    if (typeof v === "string" || typeof v === "number") return [{ slug: slugs[0]!, id: v }];
    return [];
  });
}

const fromRef = (r: Ref, poly: boolean): Id | PolyValue => (poly ? { relationTo: r.slug, value: r.id } : r.id);

export function RelationshipField(props: PanelFieldProps) {
  const field = props.field as RelClientField;
  const slugs = useMemo(() => (Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]), [field.relationTo]);
  const poly = Array.isArray(field.relationTo);
  const multiple = Boolean(field.hasMany);
  const f = usePanelField<unknown>(props);
  const api = usePayloadApi();
  const motionFor = useFieldMotion();
  const id = fieldId(f.path);
  const errorId = `${id}-error`;

  const refs = useMemo(() => toRefs(f.value, slugs, poly), [f.value, slugs, poly]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const typed = useRef(false);

  const missing = refs.filter((r) => !(keyOf(r) in labels));
  const missingKey = missing.map(keyOf).join(",");
  useEffect(() => {
    if (!missingKey) return;
    const ctrl = new AbortController();
    const bySlug = new Map<string, Id[]>();
    for (const r of missing) bySlug.set(r.slug, [...(bySlug.get(r.slug) ?? []), r.id]);
    Promise.all(
      [...bySlug].map(async ([slug, ids]) => {
        const docs = await api.find(slug, { ids, limit: ids.length, signal: ctrl.signal });
        const title = api.titleField(slug);
        return ids.map((rid) => [keyOf({ slug, id: rid }), docTitle(docs.find((d) => String(d.id) === String(rid)), title) || `#${rid}`] as const);
      }),
    )
      .then((pairs) => setLabels((prev) => ({ ...prev, ...Object.fromEntries(pairs.flat()) })))
      .catch(() => undefined);
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missingKey]);

  useEffect(() => {
    if (!open || f.readOnly) return;
    const ctrl = new AbortController();
    const q = typed.current ? search.trim() : "";
    const timer = setTimeout(() => {
      setLoading(true);
      Promise.all(
        slugs.map(async (slug) => {
          const docs = await api.find(slug, { search: q, limit: 10, signal: ctrl.signal });
          const title = api.titleField(slug);
          return docs.map((d) => ({ slug, id: d.id, key: keyOf({ slug, id: d.id }), label: docTitle(d, title) }));
        }),
      )
        .then((all) => {
          const flat = all.flat();
          setResults(flat);
          setLabels((prev) => ({ ...prev, ...Object.fromEntries(flat.map((o) => [o.key, o.label])) }));
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [search, open, slugs, api, f.readOnly]);

  const selectedKeys = refs.map(keyOf);
  const single = !multiple ? refs[0] : undefined;
  const singleLabel = single ? labels[keyOf(single)] ?? "" : "";

  useEffect(() => {
    if (!multiple && !typed.current) setSearch(singleLabel);
  }, [singleLabel, multiple]);

  const selectedKey = selectedKeys.join(",");
  const singleKey = single ? keyOf(single) : null;
  const items = useMemo(() => {
    const chosen = selectedKey.split(",");
    const list = multiple ? results.filter((o) => !chosen.includes(o.key)) : [...results];
    if (single && singleKey && !list.some((o) => o.key === singleKey)) list.unshift({ ...single, key: singleKey, label: singleLabel });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, multiple, selectedKey, singleKey, singleLabel]);

  const commit = (next: Ref[]) => {
    if (multiple) f.setValue(next.map((r) => fromRef(r, poly)));
    else f.setValue(next[0] ? fromRef(next[0], poly) : null);
  };

  const pick = (key: string | null) => {
    typed.current = false;
    if (key == null) {
      if (!multiple) commit([]);
      return;
    }
    const opt = items.find((o) => o.key === key);
    if (!opt) return;
    if (multiple) {
      commit([...refs, opt]);
      setSearch("");
    } else {
      commit([opt]);
      setSearch(opt.label);
    }
  };

  const showSlug = slugs.length > 1;

  if (f.readOnly) {
    return (
      <FieldShell path={f.path} type="relationship" style={f.style} className={f.className}>
        <ReadOnlyValue id={id} label={f.label} description={f.description} value={refs.map((r) => labels[keyOf(r)] ?? `#${r.id}`).join(", ")} />
      </FieldShell>
    );
  }

  return (
    <FieldShell path={f.path} type="relationship" style={f.style} className={f.className} invalid={f.invalid}>
      <ComboBox
        name={f.path}
        items={items}
        selectedKey={multiple ? null : single ? keyOf(single) : null}
        onSelectionChange={(key) => pick(key == null ? null : String(key))}
        inputValue={search}
        onInputChange={(v) => {
          typed.current = true;
          setSearch(v);
          if (!multiple && v === "" && single) commit([]);
        }}
        onOpenChange={setOpen}
        menuTrigger="focus"
        allowsEmptyCollection
        isRequired={f.required}
        isInvalid={f.invalid}
        validationBehavior="aria"
        className="flex flex-col gap-1.5"
      >
        <PanelLabel required={f.required}>{f.label}</PanelLabel>
        <PanelDescription>{f.description}</PanelDescription>
        <ComboBox.InputGroup className="max-w-xl">
          <Input id={id} placeholder={multiple ? "Wyszukaj i dodaj…" : "Wyszukaj…"} aria-describedby={f.invalid ? errorId : undefined} />
          <ComboBox.Trigger aria-label="Pokaż wyniki">{loading && open ? <Spinner size="sm" /> : undefined}</ComboBox.Trigger>
        </ComboBox.InputGroup>
        <ComboBox.Popover className="pf-popover">
          <ListBox
            renderEmptyState={() => <p className="px-3 py-2 text-sm text-(--ink-3)">{loading ? "Szukam…" : "Brak wyników"}</p>}
          >
            {(item: Option) => (
              <ListBox.Item id={item.key} textValue={item.label}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{item.label}</span>
                  {showSlug && <span className="text-xs text-(--ink-3)">{api.labelOf(item.slug)}</span>}
                </span>
                <ListBox.ItemIndicator />
              </ListBox.Item>
            )}
          </ListBox>
        </ComboBox.Popover>
      </ComboBox>

      {multiple && (
        <motion.ul layout className="flex flex-wrap gap-2" aria-label={`Wybrane: ${f.label ?? ""}`}>
          <AnimatePresence initial={false}>
            {refs.map((r) => (
              <motion.li
                key={keyOf(r)}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={motionFor("fast")}
              >
                <Chip size="md" variant="soft" className="gap-1 pr-1">
                  <Chip.Label>{labels[keyOf(r)] ?? `#${r.id}`}</Chip.Label>
                  <CloseButton aria-label={`Usuń ${labels[keyOf(r)] ?? r.id}`} className="size-5" onPress={() => commit(refs.filter((x) => keyOf(x) !== keyOf(r)))} />
                </Chip>
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
      <PanelError id={errorId} message={f.error} />
    </FieldShell>
  );
}
