import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CollectionConfig } from "payload";
import { loggedIn } from "../access";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/** Blankiety, które przyjmuje silnik AI (zgodnie z /api/v1/convert w FastAPI). */
export const SOURCE_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/x-cfb", // .doc rozpoznany po zawartości (OLE)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Plik", plural: "Pliki" },
  admin: { group: "Formularze", defaultColumns: ["filename", "mimeType", "filesize", "createdAt"] },
  access: { read: loggedIn, create: loggedIn, update: loggedIn, delete: loggedIn },
  upload: {
    staticDir: path.resolve(dirname, "../../../data/media"),
    mimeTypes: SOURCE_MIME_TYPES,
  },
  fields: [{ name: "alt", label: "Opis", type: "text" }],
};
