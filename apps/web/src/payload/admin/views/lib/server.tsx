/** Wspólne dla serwerowych widoków panelu: szablon z nawigacją, wymóg zalogowania, mapowanie dokumentów. */
import { DefaultTemplate } from "@payloadcms/next/templates";
import { redirect } from "next/navigation";
import type { AdminViewServerProps } from "payload";
import type { ReactNode } from "react";
import type { FormSchema, LintFlag } from "@/types";
import type { AuditItem, FormDoc } from "./types";

/** Własne widoki z `path` Payload renderuje bez szablonu – owijamy je w DefaultTemplate (nawigacja agenta B). */
export function PanelPage({ props, children }: { props: AdminViewServerProps; children: ReactNode }) {
  const { initPageResult, params, searchParams } = props;
  const { req, locale, permissions, visibleEntities } = initPageResult;
  if (!req.user) {
    const segments = Array.isArray(params?.segments) ? params.segments.join("/") : "";
    redirect(`/official/login?redirect=${encodeURIComponent(`/official/${segments}`)}`);
  }
  return (
    <DefaultTemplate
      i18n={req.i18n}
      locale={locale}
      params={params}
      payload={req.payload}
      permissions={permissions}
      searchParams={searchParams}
      user={req.user ?? undefined}
      visibleEntities={visibleEntities}
      req={req}
    >
      {children}
    </DefaultTemplate>
  );
}

/** Kontener treści widoku: te same marginesy co strona główna. */
export const Gutter = ({ children }: { children: ReactNode }) => (
  <div className="panel-view mx-auto w-full max-w-[1200px] px-4 pt-8 pb-24 sm:px-8 sm:pt-12">{children}</div>
);

type Raw = Record<string, unknown> & { id: number | string };

const relId = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "object") return Number((v as { id: unknown }).id);
  return Number(v);
};

export function toFormDoc(doc: Raw): FormDoc {
  const source = doc.source as { filename?: string } | number | null | undefined;
  const schema = (doc.schema ?? null) as FormSchema | null;
  return {
    id: Number(doc.id),
    title: String(doc.title ?? schema?.title ?? "Nowy formularz"),
    status: (doc.status as FormDoc["status"]) ?? "draft",
    aiStatus: (doc.aiStatus as FormDoc["aiStatus"]) ?? "idle",
    aiError: (doc.aiError as string | null) ?? null,
    fastapiDraftId: (doc.fastapiDraftId as string | null) ?? null,
    schema: schema && Array.isArray(schema.pages) ? schema : null,
    lintFlags: Array.isArray(doc.lintFlags) ? (doc.lintFlags as LintFlag[]) : [],
    version: Number(doc.version ?? 0),
    updatedAt: String(doc.updatedAt ?? new Date().toISOString()),
    sourceName: (typeof source === "object" && source?.filename) || schema?.sourceFile || null,
  };
}

export function toAuditItem(doc: Raw, titles: Map<number, string>): AuditItem {
  const formId = relId(doc.form);
  return {
    id: Number(doc.id),
    at: String(doc.createdAt),
    action: doc.action as AuditItem["action"],
    actor: String(doc.actorName ?? "System"),
    details: String(doc.details ?? ""),
    aiOutputRef: (doc.aiOutputRef as string | null) ?? null,
    formId,
    formTitle: formId != null ? (titles.get(formId) ?? null) : null,
  };
}
