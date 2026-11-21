import type { AuditEntry } from "../types";

/** MOCK: historia decyzji. Docelowo: GET /audit?draftId=… */
export const auditTrail: AuditEntry[] = [
  {
    id: "a-1",
    draftId: "draft-dodatek-mieszkaniowy",
    at: "2026-11-21T13:05:00+01:00",
    userId: "u-official",
    userName: "Anna Nowak",
    action: "upload",
    details: "Wgrano plik wniosek_dodatek_mieszkaniowy_skan.pdf (skan, OCR).",
  },
  {
    id: "a-2",
    draftId: "draft-dodatek-mieszkaniowy",
    at: "2026-11-21T13:06:30+01:00",
    userId: "system",
    userName: "System",
    action: "draft_generated",
    details: "Wygenerowano wersję roboczą: 3 strony, 19 pól.",
    aiOutputRef: "bielik-11b-q4 / prompt generate_form v0.3",
  },
  {
    id: "a-3",
    draftId: "draft-dodatek-mieszkaniowy",
    at: "2026-11-21T13:07:00+01:00",
    userId: "system",
    userName: "System",
    action: "linters_run",
    details: "Uruchomiono 5 linterów.",
  },
];
