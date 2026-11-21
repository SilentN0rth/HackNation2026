import type { CollectionConfig } from "payload";
import { anyone, loggedIn } from "../access";

/** Wnioski obywateli. Obywatel nie loguje się do Payloada (makieta węzła krajowego), stąd publiczny zapis. */
export const Applications: CollectionConfig = {
  slug: "applications",
  labels: { singular: "Wniosek", plural: "Wnioski" },
  admin: { useAsTitle: "formTitle", group: "Obywatele", defaultColumns: ["formTitle", "status", "confirmationNo", "updatedAt"] },
  defaultSort: "-updatedAt",
  access: { read: anyone, create: anyone, update: anyone, delete: loggedIn },
  fields: [
    { name: "form", label: "Formularz", type: "relationship", relationTo: "forms", required: true },
    { name: "formTitle", label: "Tytuł formularza", type: "text" },
    {
      name: "status",
      label: "Status",
      type: "select",
      required: true,
      defaultValue: "draft",
      options: [
        { label: "Wersja robocza", value: "draft" },
        { label: "Wysłany", value: "sent" },
        { label: "Przyjęty", value: "accepted" },
      ],
    },
    { name: "values", label: "Wartości pól", type: "json", required: true, defaultValue: {} },
    { name: "confirmationNo", label: "Numer UPO", type: "text", admin: { readOnly: true } },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req }) => {
        if (data.form && !data.formTitle) {
          const form = await req.payload.findByID({ collection: "forms", id: data.form, req, overrideAccess: true, depth: 0 }).catch(() => null);
          if (form?.title) data.formTitle = form.title;
        }
        if (data.status === "sent" && !data.confirmationNo) {
          const d = new Date();
          const seq = String(Math.floor(Math.random() * 1e6)).padStart(6, "0");
          data.confirmationNo = `UPO/${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${seq}`;
        }
        return data;
      },
    ],
  },
};
