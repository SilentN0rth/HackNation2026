import { z } from "zod";
import type { CollectionConfig, Validate } from "payload";
import { loggedIn } from "../access";
import { regenerateEndpoint, relintEndpoint } from "../endpoints/forms";
import { auditFormChange, generateSchema, publishBookkeeping } from "../hooks/forms";
import { FormSchemaSchema, LintFlagSchema } from "../../types";

function zodJson(schema: z.ZodType): Validate {
  return (value) => {
    if (value === null || value === undefined) return true;
    const parsed = schema.safeParse(value);
    return parsed.success ? true : `Niezgodny format: ${z.prettifyError(parsed.error)}`;
  };
}

export const FORM_STATUS = [
  { label: "Wersja robocza", value: "draft" },
  { label: "Do weryfikacji", value: "in_review" },
  { label: "Opublikowany", value: "published" },
] as const;

export const Forms: CollectionConfig = {
  slug: "forms",
  labels: { singular: "Formularz", plural: "Formularze" },
  admin: {
    useAsTitle: "title",
    group: "Formularze",
    defaultColumns: ["title", "status", "version", "updatedAt"],
    listSearchableFields: ["title", "slug"],
  },
  versions: { drafts: true, maxPerDoc: 50 },
  access: {
    // Obywatel (bez logowania) widzi tylko opublikowane e-usługi.
    read: ({ req }) => (req.user ? true : { status: { equals: "published" } }),
    create: loggedIn,
    update: loggedIn,
    delete: loggedIn,
  },
  endpoints: [relintEndpoint, regenerateEndpoint],
  hooks: {
    beforeValidate: [generateSchema],
    beforeChange: [publishBookkeeping],
    afterChange: [auditFormChange],
  },
  fields: [
    { name: "title", label: "Tytuł", type: "text" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      defaultValue: "draft",
      index: true,
      options: [...FORM_STATUS],
      admin: { position: "sidebar" },
    },
    {
      name: "slug",
      label: "Identyfikator",
      type: "text",
      unique: true,
      index: true,
      admin: { position: "sidebar", description: "Stały identyfikator formularza (np. z importu)." },
    },
    {
      name: "source",
      label: "Plik źródłowy",
      type: "upload",
      relationTo: "media",
      admin: { description: "Po wgraniu silnik AI generuje schemat i uruchamia kontrolę jakości." },
    },
    { name: "summary", label: "Opis dla obywatela", type: "textarea" },
    { name: "estimatedMinutes", label: "Szacowany czas (min)", type: "number", min: 1 },
    { name: "schema", label: "Schemat formularza", type: "json", validate: zodJson(FormSchemaSchema) },
    { name: "lintFlags", label: "Uwagi kontroli jakości", type: "json", validate: zodJson(z.array(LintFlagSchema)) },
    {
      name: "coiJson",
      label: "JSON COI",
      type: "json",
      virtual: true,
      admin: { readOnly: true, description: "Wyliczany przy odczycie – eksport do systemu COI." },
      hooks: {
        // Oryginalny JSON COI z FastAPI, a bez niego – schemat edytora (brak adaptera po stronie web).
        afterRead: [({ siblingData }) => siblingData.coiSource ?? siblingData.schema ?? null],
      },
    },
    { name: "coiSource", type: "json", admin: { hidden: true } },
    {
      name: "aiStatus",
      label: "Silnik AI",
      type: "select",
      defaultValue: "idle",
      options: [
        { label: "Brak zadania", value: "idle" },
        { label: "Gotowe", value: "ready" },
        { label: "Błąd", value: "error" },
      ],
      admin: { position: "sidebar", readOnly: true },
    },
    { name: "aiError", label: "Błąd silnika AI", type: "text", admin: { position: "sidebar", readOnly: true, condition: (d) => d.aiStatus === "error" } },
    { name: "fastapiDraftId", label: "Id w silniku AI", type: "text", admin: { position: "sidebar", readOnly: true } },
    { name: "version", label: "Wersja", type: "number", defaultValue: 0, admin: { position: "sidebar", readOnly: true } },
    { name: "publishedAt", label: "Opublikowano", type: "date", admin: { position: "sidebar", readOnly: true } },
    { name: "publishedBy", label: "Opublikował(a)", type: "relationship", relationTo: "users", admin: { position: "sidebar", readOnly: true } },
    // Kopia nazwiska dla obywatela – kolekcja users nie jest publiczna.
    { name: "publishedByName", type: "text", admin: { hidden: true } },
  ],
};
