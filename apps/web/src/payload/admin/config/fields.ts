/**
 * Fragment: POLA (agent D). Edytuje tylko agent D.
 * Każdy typ pola używany w kolekcjach/globalach dostaje własny komponent HeroUI (src/payload/admin/fields).
 * byPath – pola wymagające innej kontrolki niż domyślna dla typu (segmenty, przełącznik).
 * Komórek list (Cell) tu nie ma – należą do widoku listy (agent C).
 * Pole email/hasło z `auth` dokłada Payload po sklejeniu fragmentów, więc logowanie (agent B) zostaje nietknięte.
 * Kształt: PanelFragment z ./types.ts (FieldComponentMap).
 */
import type { FieldComponents, FieldType, PanelFragment } from "./types";

const F = "@/payload/admin/fields";
const field = (file: string, name: string): FieldComponents => ({ Field: `${F}/${file}#${name}` });

/** Pola z natywnym edytorem – podmieniamy tylko etykietę, opis i błąd. */
const parts: FieldComponents = {
  Label: `${F}/FieldParts#FieldLabel`,
  Description: `${F}/FieldParts#FieldDescription`,
  Error: `${F}/FieldParts#FieldError`,
};

const byType: Partial<Record<FieldType, FieldComponents>> = {
  text: field("TextField", "TextField"),
  email: field("TextField", "EmailField"),
  textarea: field("TextField", "TextareaField"),
  number: field("NumberField", "NumberField"),
  point: field("NumberField", "PointField"),
  date: field("DateField", "DateField"),
  select: field("SelectField", "SelectField"),
  radio: field("SelectField", "RadioField"),
  checkbox: field("CheckboxField", "CheckboxField"),
  relationship: field("RelationshipField", "RelationshipField"),
  upload: field("UploadField", "UploadField"),
  json: field("JSONField", "JSONField"),
  code: field("JSONField", "CodeField"),
  array: field("LayoutFields", "ArrayField"),
  group: field("LayoutFields", "GroupField"),
  row: field("LayoutFields", "RowField"),
  collapsible: field("LayoutFields", "CollapsibleField"),
  tabs: field("LayoutFields", "TabsField"),
  richText: parts,
  blocks: parts,
  join: parts,
};

const segmented = field("SelectField", "SegmentedSelectField");

export const fragment: PanelFragment = {
  fields: {
    byType,
    byPath: {
      "forms.status": segmented,
      "applications.status": segmented,
      "settings.density": segmented,
      "settings.theme": segmented,
      "settings.animations": field("CheckboxField", "SwitchField"),
    },
  },
};
