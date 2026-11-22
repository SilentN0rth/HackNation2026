import type { FormDraft } from "../types";
import { formDraft } from "./formDraft";

export const drafts: FormDraft[] = [
  formDraft,
  {
    id: "draft-karta-parkingowa",
    status: "processing",
    createdAt: "2026-11-21T14:20:00+01:00",
    updatedAt: "2026-11-21T14:20:00+01:00",
    createdBy: "u-official",
    schema: {
      id: "karta-parkingowa",
      version: 0,
      title: "Wniosek o wydanie karty parkingowej",
      issuer: "Urząd Miasta (przykład)",
      sourceFile: "karta_parkingowa.docx",
      pages: [],
    },
  },
];
