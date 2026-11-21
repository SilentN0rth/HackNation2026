/**
 * Fragment: POLA (agent D). Edytuje tylko agent D.
 * Tu: fields.byType (np. text → "@/payload/admin/fields/TextField#TextField") i fields.byPath ("forms.schema" → …).
 * Komponenty Cell dla list też mogą być tutaj (byType.select.Cell itd.).
 * Kształt: PanelFragment z ./types.ts (FieldComponentMap).
 */
import type { PanelFragment } from "./types";

export const fragment: PanelFragment = {
  fields: { byType: {}, byPath: {} },
};
