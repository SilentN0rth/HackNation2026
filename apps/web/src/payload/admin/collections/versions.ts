import type { Payload, SanitizedCollectionConfig, SanitizedGlobalConfig, TypedUser } from "payload";
import { formatDate } from "@/lib/format";
import type { Tone } from "./config";
import { formatSize, optionLabel, type NamedField } from "./server";

export type VersionRow = { id: string; date: string; status: "draft" | "published"; autosave: boolean; latest: boolean; author: string | null };
export type VersionList = { rows: VersionRow[]; page: number; totalPages: number; totalDocs: number };
export type DiffRow = { name: string; label: string; before: string; after: string; changed: boolean; tone?: Tone };

type Raw = { id: string | number; createdAt?: string; updatedAt?: string; latest?: boolean; autosave?: boolean; version?: Record<string, unknown> };

const toRow = (v: Raw): VersionRow => ({
  id: String(v.id),
  date: formatDate(String(v.updatedAt ?? v.createdAt)),
  status: v.version?._status === "published" ? "published" : "draft",
  autosave: Boolean(v.autosave),
  latest: Boolean(v.latest),
  author: (v.version?.publishedByName as string) || null,
});

export async function loadVersions(
  payload: Payload,
  user: TypedUser | null | undefined,
  entity: SanitizedCollectionConfig | SanitizedGlobalConfig,
  kind: "collection" | "global",
  id: string | undefined,
  page: number,
): Promise<VersionList> {
  const args = { limit: 20, page, sort: "-updatedAt", user, overrideAccess: false, depth: 0 } as const;
  const res =
    kind === "collection"
      ? await payload.findVersions({ ...args, collection: entity.slug as never, where: { parent: { equals: id } } })
      : await payload.findGlobalVersions({ ...args, slug: entity.slug as never });
  return { rows: (res.docs as unknown as Raw[]).map(toRow), page: res.page ?? 1, totalPages: res.totalPages, totalDocs: res.totalDocs };
}

export async function loadVersion(
  payload: Payload,
  user: TypedUser | null | undefined,
  entity: SanitizedCollectionConfig | SanitizedGlobalConfig,
  kind: "collection" | "global",
  id: string | undefined,
  versionID: string,
) {
  const common = { id: versionID, user, overrideAccess: false, depth: 0 } as const;
  const version = (
    kind === "collection"
      ? await payload.findVersionByID({ ...common, collection: entity.slug as never }).catch(() => null)
      : await payload.findGlobalVersionByID({ ...common, slug: entity.slug as never }).catch(() => null)
  ) as Raw | null;
  if (!version) return null;
  const where = { updatedAt: { less_than: version.updatedAt ?? version.createdAt } };
  const prevArgs = { limit: 1, sort: "-updatedAt", user, overrideAccess: false, depth: 0 } as const;
  const prev =
    kind === "collection"
      ? await payload.findVersions({ ...prevArgs, collection: entity.slug as never, where: { and: [{ parent: { equals: id } }, where] } })
      : await payload.findGlobalVersions({ ...prevArgs, slug: entity.slug as never, where });
  const previous = (prev.docs[0] as unknown as Raw | undefined) ?? null;
  return {
    meta: toRow(version),
    before: previous?.version ?? {},
    after: version.version ?? {},
    compareLabel: previous ? `poprzednią wersją z ${formatDate(String(previous.updatedAt ?? previous.createdAt))}` : "pustym dokumentem",
  };
}

function show(field: NamedField, v: unknown): string {
  if (v == null || v === "") return "";
  if (field.type === "select" || field.type === "radio") return Array.isArray(v) ? v.map((x) => optionLabel(field, x)).join(", ") : optionLabel(field, v);
  if (field.type === "date") return formatDate(String(v));
  if (field.type === "checkbox") return v ? "Tak" : "Nie";
  if (field.name === "filesize") return formatSize(v);
  if (typeof v === "object") return JSON.stringify(v, null, 2);
  return String(v);
}

export function diffFields(fields: NamedField[], before: Record<string, unknown>, after: Record<string, unknown>, tones?: Record<string, Tone>): DiffRow[] {
  return fields
    .filter((f) => f.type !== "join")
    .map((f) => {
      const a = show(f, before[f.name]);
      const b = show(f, after[f.name]);
      return { name: f.name, label: typeof f.label === "string" ? f.label : f.name, before: a, after: b, changed: a !== b, tone: f.type === "select" ? tones?.[String(after[f.name])] : undefined };
    });
}
