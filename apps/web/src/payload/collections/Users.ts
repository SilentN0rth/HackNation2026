import type { CollectionConfig } from "payload";
import { adminOnly, adminOnlyField, adminOrSelf, loggedIn } from "../access";
import { demoLoginEndpoint } from "../endpoints/demoLogin";

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export const Users: CollectionConfig = {
  slug: "users",
  labels: { singular: "Użytkownik", plural: "Użytkownicy" },
  auth: true,
  admin: { useAsTitle: "name", defaultColumns: ["name", "email", "role"], group: "Administracja" },
  access: { read: loggedIn, create: adminOnly, update: adminOrSelf, delete: adminOnly },
  endpoints: [demoLoginEndpoint],
  fields: [
    { name: "name", label: "Imię i nazwisko", type: "text", required: true },
    {
      name: "initials",
      label: "Inicjały",
      type: "text",
      maxLength: 3,
      admin: { description: "Do dziennika decyzji. Puste – wyliczane z imienia i nazwiska." },
    },
    {
      name: "role",
      label: "Rola",
      type: "select",
      required: true,
      defaultValue: "official",
      saveToJWT: true,
      access: { update: adminOnlyField },
      options: [
        { label: "Urzędnik", value: "official" },
        { label: "Administrator", value: "admin" },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      ({ data }) => {
        if (data.name && !data.initials) data.initials = initialsOf(String(data.name));
        return data;
      },
    ],
  },
};
