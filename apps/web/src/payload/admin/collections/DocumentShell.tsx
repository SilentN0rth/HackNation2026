"use client";

import { Link, Tabs } from "@heroui/react";
import { useStepNav } from "@payloadcms/ui";
import { useEffect, type ReactNode } from "react";
import type { Tone } from "./config";
import { Icon, PageHeader, StatusChip, ViewRoot, type Crumb } from "./ui";

export type ShellData = {
  slug: string;
  kind: "collection" | "global";
  id: string | null;
  base: string;
  adminRoute: string;
  apiRoute: string;
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  description?: string;
  status?: { label: string; tone: Tone };
  draftPending: boolean;
  tabs: { id: string; label: string; href: string }[];
  meta: { createdAt: string | null; updatedAt: string | null; author: string | null };
  previewHref: string | null;
};

/** Wspólna oprawa dokumentu: okruszki, tytuł, status, zakładki (Edycja / Wersje / API / widoki innych agentów). */
export function DocumentShell({ data, active, children, bare }: { data: ShellData; active: string; children: ReactNode; bare?: boolean }) {
  const { setStepNav } = useStepNav();
  useEffect(() => {
    // Okruszki dla nagłówka panelu (agent B) – bez pierwszego „Panel”.
    setStepNav(data.crumbs.slice(1).map((c) => ({ label: c.label, url: c.href })));
  }, [data.crumbs, setStepNav]);

  return (
    <ViewRoot testId={`document-${data.slug}`}>
      <PageHeader
        crumbs={data.crumbs}
        eyebrow={data.eyebrow}
        title={<span data-testid="document-title">{data.title}</span>}
        description={data.description}
        meta={
          (data.status || data.draftPending || data.previewHref) && (
            <>
              {data.status && <StatusChip label={data.status.label} tone={data.status.tone} />}
              {data.draftPending && <StatusChip label="Zmiany nieopublikowane" tone="warning" />}
              {data.previewHref && (
                <Link href={data.previewHref} target="_blank" className="link-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-accent" data-testid="preview-link">
                  Podgląd dla obywatela
                  {Icon.external}
                </Link>
              )}
            </>
          )
        }
      />
      {data.tabs.length > 1 && (
        <Tabs selectedKey={active} className="mb-10" aria-label="Widoki dokumentu">
          <Tabs.ListContainer>
            <Tabs.List aria-label="Widoki dokumentu" className="overflow-x-auto">
              {data.tabs.map((t) => (
                <Tabs.Tab key={t.id} id={t.id} href={t.href} className="text-[15px] font-semibold whitespace-nowrap" data-testid={`tab-${t.id}`}>
                  {t.label}
                  <Tabs.Indicator />
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs.ListContainer>
        </Tabs>
      )}
      {bare ? children : <div>{children}</div>}
    </ViewRoot>
  );
}
