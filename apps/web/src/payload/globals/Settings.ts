import type { GlobalConfig } from "payload";
import { loggedIn } from "../access";

/** Preferencje panelu urzędnika (agent B podpina je pod motyw i shell). */
export const Settings: GlobalConfig = {
  slug: "settings",
  label: "Preferencje",
  admin: { group: "Administracja" },
  access: { read: loggedIn, update: loggedIn },
  fields: [
    {
      name: "density",
      label: "Gęstość",
      type: "select",
      required: true,
      defaultValue: "comfortable",
      options: [
        { label: "Wygodna", value: "comfortable" },
        { label: "Zwarta", value: "compact" },
      ],
    },
    {
      name: "theme",
      label: "Motyw",
      type: "select",
      required: true,
      defaultValue: "system",
      options: [
        { label: "Systemowy", value: "system" },
        { label: "Jasny", value: "light" },
        { label: "Ciemny", value: "dark" },
      ],
    },
    {
      name: "defaultView",
      label: "Widok startowy",
      type: "select",
      required: true,
      defaultValue: "dashboard",
      options: [
        { label: "Pulpit", value: "dashboard" },
        { label: "Formularze", value: "forms" },
        { label: "Dziennik decyzji", value: "audit-log" },
      ],
    },
    { name: "animations", label: "Animacje", type: "checkbox", defaultValue: true },
  ],
};
