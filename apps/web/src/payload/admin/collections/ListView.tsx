/**
 * Widok listy dowolnej kolekcji (serwer). Payload podaje dane (renderListView → ListQueryProvider),
 * tu zamieniamy je na serializowalne wiersze, a UI rysuje klient na HeroUI (ListClient).
 */
import type { ListViewServerProps } from "payload";
import { formatDate } from "@/lib/format";
import { viewConfig } from "./config";
import { ListClient } from "./ListClient";
import { buildColumns, cellValue, formatSize, labelText, mimeLabel, namedFields, optionLabel, resolveRelations } from "./server";
import type { FilterDef, ListRow, ListViewData } from "./types";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export async function ListView(props: ListViewServerProps) {
  const { collectionConfig: cc, data, payload, user, listPreferences, hasCreatePermission, hasDeletePermission, newDocumentURL } = props;
  const slug = cc.slug;
  const cfg = viewConfig(slug);
  const adminRoute = payload.config.routes.admin;
  const apiRoute = payload.config.routes.api;
  const fields = namedFields(cc.fields);
  const byName = new Map(fields.map((f) => [f.name, f]));
  const docs = (data?.docs ?? []) as Record<string, unknown>[];

  const columns = buildColumns(slug, cc.fields, cc.admin.defaultColumns, listPreferences?.columns, Boolean(cc.upload));
  const relations = await resolveRelations(payload, user, undefined, docs, fields, adminRoute);
  const useAsTitle = cc.admin.useAsTitle ?? "id";
  const statusField = cfg.statusField ? byName.get(cfg.statusField) : undefined;

  const rows: ListRow[] = docs.map((doc) => {
    const id = doc.id as string | number;
    const href = `${adminRoute}/collections/${slug}/${id}`;
    const title = String(doc[useAsTitle] ?? doc.filename ?? "") || `${labelText(cc.labels.singular, slug)} #${id}`;
    const cells = Object.fromEntries(columns.map((c) => [c.name, cellValue(c, doc, byName.get(c.name), relations, cfg.tones)]));
    const row: ListRow = { id, title, href, cells };
    if (statusField && doc[statusField.name] != null) {
      const v = String(doc[statusField.name]);
      row.status = { label: optionLabel(statusField, v), tone: cfg.tones?.[v] ?? "neutral" };
    }
    if (slug === "forms" && doc.status === "published") row.previewHref = `/citizen/form/${id}`;
    if (slug === "audit-log") {
      const userRef = relations.get(`users:${typeof doc.user === "object" ? (doc.user as { id: number })?.id : doc.user}`);
      const actor = String(doc.actorName ?? userRef?.title ?? "System");
      const formRef = relations.get(`forms:${typeof doc.form === "object" ? (doc.form as { id: number })?.id : doc.form}`);
      row.timeline = {
        actor,
        initials: initialsOf(actor) || "AI",
        date: doc.createdAt ? formatDate(String(doc.createdAt)) : "",
        details: String(doc.details ?? ""),
        link: formRef ? { label: formRef.title, href: formRef.href } : undefined,
      };
    }
    if (cc.upload) {
      const mime = String(doc.mimeType ?? "");
      row.file = {
        mime,
        ext: mimeLabel(mime),
        size: formatSize(doc.filesize),
        date: doc.createdAt ? formatDate(String(doc.createdAt)) : "",
        thumb: mime.startsWith("image/") ? String(doc.thumbnailURL || doc.url || "") || undefined : undefined,
        url: doc.url ? String(doc.url) : undefined,
      };
    }
    return row;
  });

  const filters: FilterDef[] = (cfg.filters ?? [])
    .map((name) => byName.get(name))
    .filter((f): f is NonNullable<typeof f> => Boolean(f?.options))
    .map((f) => ({
      name: f.name,
      label: labelText(f.label, f.name),
      options: (f.options ?? []).map((o) => (typeof o === "string" ? { value: o, label: o } : { value: o.value, label: labelText(o.label, o.value) })),
    }));

  const view: ListViewData = {
    slug,
    singular: labelText(cc.labels.singular, slug),
    plural: labelText(cc.labels.plural, slug),
    config: cfg,
    columns,
    rows,
    filters,
    page: data?.page ?? 1,
    totalPages: data?.totalPages ?? 1,
    totalDocs: data?.totalDocs ?? 0,
    limit: data?.limit ?? props.limit ?? 10,
    canCreate: Boolean(hasCreatePermission) && !cfg.readOnly,
    canDelete: Boolean(hasDeletePermission) && !cfg.readOnly,
    newHref: newDocumentURL,
    apiRoute,
    adminRoute,
  };

  return <ListClient data={view} />;
}
