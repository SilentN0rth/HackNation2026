/** Sklejanie fragmentów panelu (etap 0 – agenci nie edytują tego pliku). Kontrakt: types.ts. */
import type { CollectionConfig, Field, GlobalConfig } from "payload";
import type { FieldComponents, PanelFragment } from "./types";

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain => typeof v === "object" && v !== null && !Array.isArray(v);
// { path: "…" } to pojedynczy komponent Payloada – nie łączymy go pole po polu.
const isComponent = (v: unknown) => isPlain(v) && typeof v.path === "string";

export function mergeDeep<T>(base: T, extra: unknown): T {
  if (extra === undefined) return base;
  if (Array.isArray(base) && Array.isArray(extra)) return [...base, ...extra] as T;
  if (isPlain(base) && isPlain(extra) && !isComponent(base) && !isComponent(extra)) {
    const out: Plain = { ...base };
    for (const [key, value] of Object.entries(extra)) out[key] = key in out ? mergeDeep(out[key], value) : value;
    return out as T;
  }
  return extra as T;
}

export function mergeFragments(fragments: PanelFragment[]): PanelFragment {
  return fragments.reduce<PanelFragment>((acc, f) => mergeDeep(acc, f), {});
}

type AnyField = Field & { name?: string; fields?: Field[]; tabs?: { name?: string; fields: Field[] }[]; admin?: Plain };

function withComponents(field: AnyField, path: string, panel: PanelFragment): AnyField {
  if (field.type === "ui") return field;
  const fromType = panel.fields?.byType?.[field.type];
  const fromPath = panel.fields?.byPath?.[path];
  if (!fromType && !fromPath) return field;
  const own = (field.admin?.components ?? {}) as FieldComponents;
  return { ...field, admin: { ...field.admin, components: { ...fromType, ...own, ...fromPath } } } as AnyField;
}

function applyFields(fields: Field[], prefix: string, panel: PanelFragment): Field[] {
  return fields.map((raw) => {
    const field = raw as AnyField;
    const path = field.name ? `${prefix}.${field.name}` : prefix;
    let next = withComponents(field, path, panel);
    if (next.fields) next = { ...next, fields: applyFields(next.fields, path, panel) } as AnyField;
    if (next.tabs) {
      next = {
        ...next,
        tabs: next.tabs.map((tab) => ({ ...tab, fields: applyFields(tab.fields, tab.name ? `${path}.${tab.name}` : path, panel) })),
      } as AnyField;
    }
    return next as Field;
  });
}

export function applyToCollections(collections: CollectionConfig[], panel: PanelFragment): CollectionConfig[] {
  return collections.map((c) => {
    const override = panel.collections?.[c.slug as keyof NonNullable<PanelFragment["collections"]>];
    return {
      ...c,
      admin: mergeDeep(c.admin ?? {}, override?.admin),
      fields: applyFields(c.fields, c.slug, panel),
    };
  });
}

export function applyToGlobals(globals: GlobalConfig[], panel: PanelFragment): GlobalConfig[] {
  return globals.map((g) => {
    const override = panel.globals?.[g.slug as keyof NonNullable<PanelFragment["globals"]>];
    return { ...g, admin: mergeDeep(g.admin ?? {}, override?.admin), fields: applyFields(g.fields, g.slug, panel) };
  });
}
