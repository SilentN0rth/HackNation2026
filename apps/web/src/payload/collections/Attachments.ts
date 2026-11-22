import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CollectionConfig } from "payload";
import { anyone, loggedIn } from "../access";

const dirname = path.dirname(fileURLToPath(import.meta.url));

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/xml", "text/xml"];

export const Attachments: CollectionConfig = {
  slug: "attachments",
  labels: { singular: "Załącznik", plural: "Załączniki" },
  admin: { group: "Obywatele", defaultColumns: ["filename", "mimeType", "filesize", "createdAt"] },
  access: { read: loggedIn, create: anyone, update: loggedIn, delete: loggedIn },
  upload: {
    staticDir: process.env.ATTACHMENTS_DIR || path.resolve(dirname, "../../../data/attachments"),
    mimeTypes: ATTACHMENT_MIME_TYPES,
  },
  hooks: {
    beforeValidate: [
      ({ req, data }) => {
        const size = req.file?.size ?? 0;
        if (size > MAX_ATTACHMENT_BYTES) throw new Error("Załącznik może mieć najwyżej 10 MB.");
        return data;
      },
    ],
  },
  fields: [],
};
