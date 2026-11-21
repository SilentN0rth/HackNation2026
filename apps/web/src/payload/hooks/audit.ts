/** Wpisy do dziennika decyzji (audit-log). Kolekcja jest zamknięta dla API – piszą tylko hooki. */
import type { PayloadRequest } from "payload";
import type { AuditAction } from "../../types";

export type AuditInput = {
  form?: number | string | null;
  action: AuditAction;
  details: string;
  aiOutputRef?: string | null;
  /** Bez użytkownika wpis jest przypisany do „System”. */
  system?: boolean;
};

export async function writeAudit(req: PayloadRequest, entry: AuditInput): Promise<void> {
  const user = entry.system ? null : req.user;
  await req.payload.create({
    collection: "audit-log",
    req,
    overrideAccess: true,
    data: {
      form: entry.form == null ? null : Number(entry.form),
      user: user?.id ?? null,
      actorName: user?.name ?? "System",
      action: entry.action,
      details: entry.details,
      aiOutputRef: entry.aiOutputRef ?? null,
    },
  });
}
