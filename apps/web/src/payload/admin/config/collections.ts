import type { CollectionSlug, GlobalSlug, PanelFragment } from "./types";

const LIST = "@/payload/admin/collections/ListView#ListView";
const DOCUMENT = "@/payload/admin/collections/DocumentRoot#DocumentRoot";

const COLLECTIONS: CollectionSlug[] = ["users", "media", "forms", "audit-log", "applications", "statute-chunks"];
const GLOBALS: GlobalSlug[] = ["settings", "registry"];

const collectionAdmin = (slug: CollectionSlug) => ({
  admin: {
    pagination: { defaultLimit: 10, limits: [10, 25, 50, 100] },
    ...(slug === "media" ? { defaultColumns: ["filename", "mimeType", "filesize", "createdAt"] } : {}),
    components: { views: { list: { Component: LIST }, edit: { root: { Component: DOCUMENT } } } },
  },
});

export const fragment: PanelFragment = {
  collections: Object.fromEntries(COLLECTIONS.map((slug) => [slug, collectionAdmin(slug)])),
  globals: Object.fromEntries(GLOBALS.map((slug) => [slug, { admin: { components: { views: { edit: { root: { Component: DOCUMENT } } } } } }])),
};
