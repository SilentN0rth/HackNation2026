import type { Field, Payload, PayloadRequest, TypedUser } from "payload";
import { formatDate } from "@/lib/format";
import { viewConfig, type Tone } from "./config";
import type { CellValue, ColumnDef, ColumnKind } from "./types";

type LabelLike = unknown;

export function labelText(label: LabelLike, fallback: string): string {
  if (typeof label === "string") return label;
  if (label && typeof label === "object") {
    const rec = label as Record<string, string>;
    return rec.pl ?? Object.values(rec)[0] ?? fallback;
  }
  return fallback;
}

export type NamedField = Field & {
  name: string;
  label?: LabelLike;
  options?: (string | { label: LabelLike; value: string })[];
  relationTo?: string | string[];
  hasMany?: boolean;
  admin?: { hidden?: boolean; position?: string; disableListColumn?: boolean };
};

export function namedFields(fields: Field[]): NamedField[] {
  const out: NamedField[] = [];
  for (const f of fields) {
    const field = f as NamedField & { fields?: Field[]; tabs?: { name?: string; fields: Field[] }[] };
    if (field.type === "row" || field.type === "collapsible") out.push(...namedFields(field.fields ?? []));
    else if (field.type === "tabs") for (const t of field.tabs ?? []) if (!t.name) out.push(...namedFields(t.fields));
    if (!("name" in field) || !field.name || field.type === "ui") continue;
    if (field.hidden || field.admin?.hidden) continue;
    out.push(field);
  }
  return out;
}

export function optionLabel(field: NamedField | undefined, value: unknown): string {
  const opt = field?.options?.find((o) => (typeof o === "string" ? o : o.value) === value);
  if (!opt) return value == null ? "" : String(value);
  return typeof opt === "string" ? opt : labelText(opt.label, opt.value);
}

const META: Record<string, { label: string; kind: ColumnKind }> = {
  id: { label: "ID", kind: "id" },
  createdAt: { label: "Utworzono", kind: "date" },
  updatedAt: { label: "Zmieniono", kind: "date" },
  filename: { label: "Nazwa pliku", kind: "text" },
  mimeType: { label: "Typ", kind: "mime" },
  filesize: { label: "Rozmiar", kind: "filesize" },
};

export function kindOf(field: NamedField, slug: string): ColumnKind {
  if (field.name === viewConfig(slug).statusField) return "status";
  switch (field.type) {
    case "date":
      return "date";
    case "number":
      return field.name === "filesize" ? "filesize" : "number";
    case "relationship":
      return "relation";
    case "upload":
      return "upload";
    case "checkbox":
      return "boolean";
    case "json":
    case "richText":
    case "array":
    case "blocks":
    case "group":
      return "json";
    case "email":
      return "email";
    case "select":
    case "radio":
      return "status";
    default:
      return field.name === "mimeType" ? "mime" : "text";
  }
}

const NOT_SORTABLE: ColumnKind[] = ["json", "relation", "upload"];

export function buildColumns(
  slug: string,
  fields: Field[],
  defaults: string[] | undefined,
  prefs: { accessor: string; active: boolean }[] | undefined,
  upload: boolean,
): ColumnDef[] {
  const byName = new Map(namedFields(fields).map((f) => [f.name, f]));
  const names = ["id", ...(upload ? ["filename", "mimeType", "filesize"] : []), ...byName.keys(), "createdAt", "updatedAt"];
  const unique = [...new Set(names)];
  const activeSet = new Set(
    prefs?.length ? prefs.filter((p) => p.active).map((p) => p.accessor) : (defaults ?? unique.filter((n) => n !== "id").slice(0, 4)),
  );
  const ordered = [...(prefs?.map((p) => p.accessor) ?? defaults ?? []), ...unique].filter((n, i, a) => unique.includes(n) && a.indexOf(n) === i);
  return ordered.map((name) => {
    const field = byName.get(name);
    const meta = META[name];
    const kind = field && !meta ? kindOf(field, slug) : (meta?.kind ?? "text");
    return {
      name,
      label: field ? labelText(field.label, name) : (meta?.label ?? name),
      kind,
      sortable: !NOT_SORTABLE.includes(kind),
      active: activeSet.has(name),
    };
  });
}

export const formatSize = (bytes: unknown) => {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
};

const EXT: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/x-cfb": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.oasis.opendocument.spreadsheet": "ODS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};

export const mimeLabel = (mime: unknown) => EXT[String(mime)] ?? (String(mime ?? "").split("/").pop() || "").toUpperCase();

type Ref = { title: string; href: string; thumb?: string; mime?: string };
export type RelationMap = Map<string, Ref>;

const idOf = (v: unknown): string | number | null =>
  v == null ? null : typeof v === "object" ? ((v as { id?: string | number }).id ?? null) : (v as string | number);

export async function resolveRelations(
  payload: Payload,
  user: TypedUser | null | undefined,
  req: PayloadRequest | undefined,
  docs: Record<string, unknown>[],
  fields: NamedField[],
  adminRoute: string,
): Promise<RelationMap> {
  const wanted = new Map<string, Set<string | number>>();
  for (const f of fields) {
    if ((f.type !== "relationship" && f.type !== "upload") || typeof f.relationTo !== "string") continue;
    for (const d of docs) {
      const vals = Array.isArray(d[f.name]) ? (d[f.name] as unknown[]) : [d[f.name]];
      for (const v of vals) {
        const id = idOf(v);
        if (id != null) (wanted.get(f.relationTo) ?? wanted.set(f.relationTo, new Set()).get(f.relationTo)!).add(id);
      }
    }
  }
  const out: RelationMap = new Map();
  await Promise.all(
    [...wanted].map(async ([collection, ids]) => {
      const config = payload.collections[collection as keyof typeof payload.collections]?.config;
      if (!config) return;
      const useAsTitle = config.admin?.useAsTitle ?? "id";
      const res = await payload
        .find({ collection: collection as never, where: { id: { in: [...ids] } }, depth: 0, limit: ids.size, overrideAccess: false, user, req, draft: true, pagination: false })
        .catch(() => ({ docs: [] as Record<string, unknown>[] }));
      for (const raw of res.docs as Record<string, unknown>[]) {
        const title = String(raw[useAsTitle] ?? raw.filename ?? raw.id);
        const mime = raw.mimeType as string | undefined;
        out.set(`${collection}:${raw.id}`, {
          title,
          href: `${adminRoute}/collections/${collection}/${raw.id}`,
          mime,
          thumb: mime?.startsWith("image/") ? ((raw.thumbnailURL as string) || (raw.url as string)) : undefined,
        });
      }
    }),
  );
  return out;
}

function stringify(v: unknown): string {
  if (v == null || v === "") return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  const s = JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

export function cellValue(
  col: ColumnDef,
  doc: Record<string, unknown>,
  field: NamedField | undefined,
  relations: RelationMap,
  tones: Record<string, Tone> | undefined,
): CellValue {
  const v = doc[col.name];
  switch (col.kind) {
    case "date":
      return v ? { text: formatDate(String(v)), mono: true } : null;
    case "status":
      return v == null || v === "" ? null : { text: optionLabel(field, v), tone: tones?.[String(v)] ?? "neutral" };
    case "boolean":
      return { text: v ? "Tak" : "Nie" };
    case "filesize":
      return { text: formatSize(v), mono: true };
    case "mime":
      return v ? { text: mimeLabel(v), mono: true } : null;
    case "number":
    case "id":
      return v == null ? null : { text: String(v), mono: true };
    case "relation":
    case "upload": {
      const rel = typeof field?.relationTo === "string" ? field.relationTo : "";
      const first = Array.isArray(v) ? v[0] : v;
      const id = idOf(first);
      if (id == null) return null;
      const ref = relations.get(`${rel}:${id}`);
      const more = Array.isArray(v) && v.length > 1 ? ` +${v.length - 1}` : "";
      return ref
        ? { text: `${ref.title}${more}`, href: ref.href, thumb: ref.thumb ?? (ref.mime ? `mime:${mimeLabel(ref.mime)}` : undefined) }
        : { text: `#${id}`, mono: true };
    }
    case "json":
      return v == null ? null : { text: stringify(v), mono: true };
    default:
      return v == null || v === "" ? null : { text: stringify(v) };
  }
}
