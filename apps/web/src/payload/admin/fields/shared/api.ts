"use client";

import { useConfig } from "@payloadcms/ui";
import { useCallback, useMemo } from "react";

export type DocLike = { id: number | string; [key: string]: unknown };

export function usePayloadApi() {
  const { config, getEntityConfig } = useConfig();
  const base = `${config.serverURL ?? ""}${config.routes.api}`;

  const titleField = useCallback(
    (slug: string) => {
      const entity = getEntityConfig({ collectionSlug: slug }) as { admin?: { useAsTitle?: string }; upload?: unknown } | undefined;
      const useAsTitle = entity?.admin?.useAsTitle;
      if (useAsTitle && useAsTitle !== "id") return useAsTitle;
      return entity?.upload ? "filename" : "id";
    },
    [getEntityConfig],
  );

  const labelOf = useCallback(
    (slug: string) => {
      const entity = getEntityConfig({ collectionSlug: slug }) as { labels?: { singular?: unknown } } | undefined;
      const singular = entity?.labels?.singular;
      return typeof singular === "string" ? singular : slug;
    },
    [getEntityConfig],
  );

  const find = useCallback(
    async (slug: string, opts: { search?: string; ids?: (string | number)[]; limit?: number; signal?: AbortSignal }) => {
      const title = titleField(slug);
      const params = new URLSearchParams({ depth: "0", limit: String(opts.limit ?? 10), sort: title === "id" ? "-createdAt" : title });
      if (opts.ids?.length) params.set("where[id][in]", opts.ids.join(","));
      else if (opts.search && title !== "id") params.set(`where[${title}][like]`, opts.search);
      const res = await fetch(`${base}/${slug}?${params}`, { credentials: "include", signal: opts.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { docs: DocLike[] };
      return json.docs;
    },
    [base, titleField],
  );

  return useMemo(() => ({ base, find, titleField, labelOf }), [base, find, titleField, labelOf]);
}

export const docTitle = (doc: DocLike | undefined, title: string) => {
  if (!doc) return "";
  const v = doc[title];
  return typeof v === "string" && v ? v : `#${doc.id}`;
};
