import type { CollectionConfig } from "payload";
import { loggedIn, nobody } from "../access";
import { AuditActionSchema, type AuditAction } from "../../types";

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  upload: "Wgranie pliku",
  draft_generated: "Wygenerowanie formularza",
  linters_run: "Kontrola jakości",
  field_edited: "Edycja",
  flag_fixed: "Poprawienie uwagi",
  flag_rejected: "Odrzucenie uwagi",
  published: "Publikacja",
};

export const AuditLog: CollectionConfig = {
  slug: "audit-log",
  labels: { singular: "Wpis dziennika", plural: "Dziennik decyzji" },
  admin: {
    useAsTitle: "details",
    group: "Formularze",
    defaultColumns: ["createdAt", "action", "actorName", "form", "details"],
  },
  defaultSort: "-createdAt",
  access: { read: loggedIn, create: nobody, update: nobody, delete: nobody },
  fields: [
    { name: "form", label: "Formularz", type: "relationship", relationTo: "forms", index: true, admin: { readOnly: true } },
    { name: "user", label: "Użytkownik", type: "relationship", relationTo: "users", admin: { readOnly: true } },
    { name: "actorName", label: "Kto", type: "text", admin: { readOnly: true } },
    {
      name: "action",
      label: "Akcja",
      type: "select",
      required: true,
      index: true,
      options: AuditActionSchema.options.map((value) => ({ value, label: AUDIT_ACTION_LABELS[value] })),
      admin: { readOnly: true },
    },
    { name: "details", label: "Opis", type: "textarea", required: true, admin: { readOnly: true } },
    { name: "aiOutputRef", label: "Wersja modelu / promptu", type: "text", admin: { readOnly: true } },
  ],
};
