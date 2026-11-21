/**
 * Fragment: KOLEKCJE (agent C). Edytuje tylko agent C.
 * Tu: collections.<slug>.admin – components.views.list / components.views.edit, beforeList,
 * components.edit (SaveButton, PublishButton, …), defaultColumns, listSearchableFields, pagination.
 * Przykład: { collections: { forms: { admin: { components: { views: { list: { Component: "@/payload/admin/collections/ListView#ListView" } } } } } } }
 * Kształt: PanelFragment z ./types.ts.
 */
import type { PanelFragment } from "./types";

export const fragment: PanelFragment = {
  collections: {},
};
