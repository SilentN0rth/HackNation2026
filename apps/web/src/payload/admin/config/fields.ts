import type { FieldComponents, FieldType, PanelFragment } from "./types";

const F = "@/payload/admin/fields";
const field = (file: string, name: string): FieldComponents => ({ Field: `${F}/${file}#${name}` });

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
