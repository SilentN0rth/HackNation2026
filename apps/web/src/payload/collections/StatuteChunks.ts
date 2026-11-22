import type { CollectionConfig } from "payload";
import { anyone, loggedIn } from "../access";

export const StatuteChunks: CollectionConfig = {
  slug: "statute-chunks",
  labels: { singular: "Fragment przepisu", plural: "Podstawy prawne" },
  admin: { useAsTitle: "unit", group: "Formularze", defaultColumns: ["unit", "act", "chunkId"] },
  access: { read: anyone, create: loggedIn, update: loggedIn, delete: loggedIn },
  fields: [
    { name: "chunkId", label: "Identyfikator", type: "text", required: true, unique: true, index: true },
    { name: "act", label: "Akt prawny", type: "text", required: true },
    { name: "unit", label: "Jednostka redakcyjna", type: "text", required: true },
    { name: "text", label: "Treść", type: "textarea", required: true },
  ],
};
