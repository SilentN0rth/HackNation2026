/**
 * Korzeń widoku dokumentu (admin.components.views.edit.root) dla kolekcji i globali (serwer).
 * Payload nie rysuje wtedy własnego nagłówka ani zakładek – rozdzielamy podwidoki sami:
 *   /            → edycja (EditView) albo edit.default innego agenta,
 *   /versions    → lista wersji,  /versions/:id → różnice + przywracanie,  /api → podgląd JSON,
 *   /<ścieżka>   → widok z edit.<klucz>.path (np. edytor formularza agenta E) przez RenderServerComponent.
 */
import type { DocumentViewServerProps, PayloadComponent, SanitizedCollectionConfig, SanitizedGlobalConfig } from "payload";
import { RenderServerComponent } from "@payloadcms/ui/elements/RenderServerComponent";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/format";
import { viewConfig } from "./config";
import { ApiView } from "./ApiView";
import { DocumentShell, type ShellData } from "./DocumentShell";
import { EditView } from "./EditView";
import { labelText, namedFields, optionLabel } from "./server";
import { VersionsView } from "./VersionsView";
import { VersionView } from "./VersionView";
import { diffFields, loadVersion, loadVersions } from "./versions";

type ViewEntry = { Component?: PayloadComponent; path?: string; tab?: { label?: unknown; href?: string; order?: number } };
const KNOWN = new Set(["root", "default", "versions", "version", "api", "livePreview"]);

export async function DocumentRoot(props: DocumentViewServerProps) {
  const { initPageResult, routeSegments, doc, payload, permissions, hasPublishedDoc, searchParams } = props;
  const collection = initPageResult.collectionConfig as SanitizedCollectionConfig | undefined;
  const global = initPageResult.globalConfig as SanitizedGlobalConfig | undefined;
  const entity = collection ?? global;
  if (!entity) notFound();

  const slug = entity.slug;
  const adminRoute = payload.config.routes.admin;
  const apiRoute = payload.config.routes.api;
  const cfg = viewConfig(slug);
  const views = (entity.admin?.components?.views?.edit ?? {}) as Record<string, ViewEntry>;
  const segments = routeSegments ?? [];
  const id = collection ? (segments[2] === "create" ? undefined : segments[2]) : undefined;
  const rest = collection ? segments.slice(3) : segments.slice(2);
  const base = collection ? `${adminRoute}/collections/${slug}${id ? `/${id}` : "/create"}` : `${adminRoute}/globals/${slug}`;
  const perm = collection ? permissions?.collections?.[slug] : permissions?.globals?.[slug];
  const drafts = Boolean(entity.versions && typeof entity.versions === "object" && entity.versions.drafts);
  const hasVersions = Boolean(entity.versions) && Boolean(perm?.readVersions) && Boolean(id || global);

  // Nagłówek wspólny dla wszystkich podwidoków.
  const data = (doc ?? {}) as Record<string, unknown>;
  const fields = namedFields(entity.fields);
  const useAsTitle = collection?.admin?.useAsTitle ?? "id";
  const singular = collection ? labelText(collection.labels.singular, slug) : labelText(global?.label, slug);
  const plural = collection ? labelText(collection.labels.plural, slug) : labelText(global?.label, slug);
  const statusField = cfg.statusField ? fields.find((f) => f.name === cfg.statusField) : undefined;
  const statusValue = statusField ? data[statusField.name] : undefined;
  const versionCount = hasVersions
    ? collection
      ? await payload.countVersions({ collection: slug as never, where: { parent: { equals: id } }, user: props.user, overrideAccess: false }).then((r) => r.totalDocs).catch(() => 0)
      : await payload.countGlobalVersions({ global: slug as never, user: props.user, overrideAccess: false }).then((r) => r.totalDocs).catch(() => 0)
    : 0;

  const customTabs = Object.entries(views)
    .filter(([key, v]) => !KNOWN.has(key) && v?.path && v.Component)
    .map(([key, v]) => ({ id: key, label: labelText(v.tab?.label, key), href: `${base}${v.path}` }));

  const shell: ShellData = {
    slug,
    kind: collection ? "collection" : "global",
    id: id ?? null,
    base,
    adminRoute,
    apiRoute,
    crumbs: collection
      ? [
          { label: "Panel", href: adminRoute },
          { label: plural, href: `${adminRoute}/collections/${slug}` },
          { label: id ? String(data[useAsTitle] || `#${id}`) : "Nowy" },
        ]
      : [{ label: "Panel", href: adminRoute }, { label: plural }],
    eyebrow: collection ? singular : "Ustawienia",
    title: collection ? (id ? String(data[useAsTitle] || `${singular} #${id}`) : `Nowy: ${singular.toLowerCase()}`) : plural,
    description: global ? cfg.description : undefined,
    status: statusField && statusValue != null ? { label: optionLabel(statusField, statusValue), tone: cfg.tones?.[String(statusValue)] ?? "neutral" } : undefined,
    draftPending: drafts && data._status === "draft" && hasPublishedDoc,
    tabs: [
      { id: "edit", label: "Edycja", href: base },
      ...(hasVersions ? [{ id: "versions", label: `Wersje${versionCount ? ` (${versionCount})` : ""}`, href: `${base}/versions` }] : []),
      ...(id || global ? [{ id: "api", label: "API", href: `${base}/api` }] : []),
      ...customTabs,
    ],
    meta: {
      createdAt: data.createdAt ? formatDate(String(data.createdAt)) : null,
      updatedAt: data.updatedAt ? formatDate(String(data.updatedAt)) : null,
      author: (data.publishedByName as string) || null,
    },
    previewHref: slug === "forms" && id && data.status === "published" ? `/citizen/form/${id}` : null,
  };

  const renderCustom = (entry: ViewEntry | undefined, active: string) =>
    entry?.Component ? (
      <DocumentShell data={shell} active={active} bare>
        {RenderServerComponent({ Component: entry.Component, importMap: payload.importMap, clientProps: { formState: props.formState, viewType: props.viewType, documentSubViewType: props.documentSubViewType }, serverProps: props })}
      </DocumentShell>
    ) : null;

  // Podwidoki
  if (rest.length === 0) {
    if (views.default?.Component) return renderCustom(views.default, "edit");
    return (
      <DocumentShell data={shell} active="edit">
        <EditView shell={shell} drafts={drafts} />
      </DocumentShell>
    );
  }

  if (rest[0] === "versions" && hasVersions) {
    if (rest.length === 1) {
      if (views.versions?.Component) return renderCustom(views.versions, "versions");
      const page = Number((searchParams as Record<string, string>)?.page ?? 1) || 1;
      const list = await loadVersions(payload, props.user, entity, collection ? "collection" : "global", id, page);
      return (
        <DocumentShell data={shell} active="versions">
          <VersionsView shell={shell} versions={list} />
        </DocumentShell>
      );
    }
    if (rest.length === 2) {
      if (views.version?.Component) return renderCustom(views.version, "versions");
      const v = await loadVersion(payload, props.user, entity, collection ? "collection" : "global", id, rest[1]!);
      if (!v) notFound();
      return (
        <DocumentShell data={shell} active="versions">
          <VersionView shell={shell} version={v.meta} diff={diffFields(fields, v.before, v.after, cfg.tones)} compareLabel={v.compareLabel} />
        </DocumentShell>
      );
    }
  }

  if (rest[0] === "api" && rest.length === 1 && (id || global)) {
    if (views.api?.Component) return renderCustom(views.api, "api");
    return (
      <DocumentShell data={shell} active="api">
        <ApiView shell={shell} doc={data} />
      </DocumentShell>
    );
  }

  const path = `/${rest.join("/")}`;
  const custom = Object.entries(views).find(([key, v]) => !KNOWN.has(key) && v?.path === path);
  if (custom) return renderCustom(custom[1], custom[0]);
  notFound();
}
