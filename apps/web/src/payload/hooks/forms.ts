import { readFile } from "node:fs/promises";
import path from "node:path";
import { APIError, type CollectionAfterChangeHook, type CollectionBeforeChangeHook, type CollectionBeforeValidateHook, type PayloadRequest } from "payload";
import { canPublish } from "../../lib/lint";
import type { FormSchema, LintFlag } from "../../types";
import { writeAudit } from "./audit";
import { FastApiError, generateDraft } from "./fastapi";

export type FormsContext = { skipAI?: boolean; skipAudit?: boolean };

type FormData = {
  title?: string | null;
  source?: number | { id: number } | null;
  schema?: FormSchema | null;
  lintFlags?: LintFlag[] | null;
  status?: "draft" | "in_review" | "published" | null;
  aiStatus?: "idle" | "ready" | "error" | null;
  aiError?: string | null;
  fastapiDraftId?: string | null;
  coiSource?: unknown;
  version?: number | null;
  publishedAt?: string | null;
  publishedBy?: number | { id: number } | null;
  publishedByName?: string | null;
};

const idOf = (v: FormData["source"]) => (v == null ? null : typeof v === "object" ? v.id : v);
const hasPages = (schema: FormData["schema"]) => Boolean(schema && Array.isArray(schema.pages) && schema.pages.length > 0);

async function loadSource(req: PayloadRequest, id: number) {
  const media = await req.payload.findByID({ collection: "media", id, req, overrideAccess: true, depth: 0 });
  const staticDir = req.payload.collections.media.config.upload.staticDir;
  if (!media.filename || !staticDir) throw new FastApiError("Wgrany plik nie ma zapisanej zawartości.");
  const data = await readFile(path.join(staticDir, media.filename));
  return { data, name: media.filename, mimeType: media.mimeType ?? "application/octet-stream" };
}

export async function fillFromSource(req: PayloadRequest, data: FormData): Promise<FormData> {
  const sourceId = idOf(data.source);
  if (!sourceId) return data;
  try {
    const file = await loadSource(req, sourceId);
    const generated = await generateDraft(file);
    return {
      ...data,
      title: data.title || generated.schema.title,
      schema: generated.schema,
      lintFlags: generated.flags,
      coiSource: generated.coi,
      fastapiDraftId: generated.draftId,
      aiStatus: "ready",
      aiError: null,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    req.payload.logger.warn(`forms: generowanie schematu nie powiodło się – ${message}`);
    return { ...data, title: data.title || "Nowy formularz", aiStatus: "error", aiError: message };
  }
}

export const generateSchema: CollectionBeforeValidateHook = async ({ data, originalDoc, operation, req, context }) => {
  if (!data || (context as FormsContext).skipAI) return data;
  const sourceChanged = operation === "create" || idOf(data.source) !== idOf(originalDoc?.source);
  if (!sourceChanged || hasPages(data.schema)) {
    if (!data.title && operation === "create") data.title = "Nowy formularz";
    return data;
  }
  return fillFromSource(req, data as FormData);
};

export const publishBookkeeping: CollectionBeforeChangeHook = ({ data, originalDoc, req, context }) => {
  const becomesPublished = data.status === "published" && originalDoc?.status !== "published";
  if (!becomesPublished || (context as FormsContext).skipAudit) return data;
  const flags = (data.lintFlags ?? originalDoc?.lintFlags ?? []) as LintFlag[];
  if (!canPublish(flags)) throw new APIError("Nie wszystkie krytyczne uwagi zostały obsłużone.", 400, null, true);
  if (!hasPages(data.schema ?? originalDoc?.schema)) throw new APIError("Formularz nie ma jeszcze schematu.", 400, null, true);
  const version = Number(originalDoc?.version ?? 0) + 1;
  const schema = (data.schema ?? originalDoc?.schema) as FormSchema;
  return {
    ...data,
    version,
    schema: { ...schema, version },
    publishedAt: new Date().toISOString(),
    publishedBy: req.user?.id ?? null,
    publishedByName: req.user?.name ?? null,
  };
};

const resolutionKey = (f: LintFlag) => (f.resolution ? `${f.resolution.action}:${f.resolution.justification ?? ""}` : "");

export const auditFormChange: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req, context }) => {
  if ((context as FormsContext).skipAudit) return doc;
  const form = doc.id as number;
  if (operation === "create") {
    if (doc.source) {
      const media = typeof doc.source === "object" ? doc.source : null;
      await writeAudit(req, { form, action: "upload", details: `Wgrano plik ${media?.filename ?? "źródłowy"}.` });
      if (doc.aiStatus === "ready") {
        const pages = (doc.schema as FormSchema | null)?.pages.length ?? 0;
        await writeAudit(req, { form, action: "draft_generated", system: true, details: `Wygenerowano formularz: ${pages} stron.`, aiOutputRef: doc.fastapiDraftId });
        const flags = (doc.lintFlags ?? []) as LintFlag[];
        const errors = flags.filter((f) => f.severity === "error").length;
        await writeAudit(req, { form, action: "linters_run", system: true, details: `Kontrola jakości: ${flags.length} uwag, w tym ${errors} krytycznych.` });
      }
    } else {
      await writeAudit(req, { form, action: "field_edited", details: `Utworzono formularz „${doc.title}”.` });
    }
    return doc;
  }

  if (doc.status === "published" && previousDoc?.status !== "published") {
    await writeAudit(req, { form, action: "published", details: `Opublikowano wersję ${doc.version}.` });
    return doc;
  }

  const before = new Map(((previousDoc?.lintFlags ?? []) as LintFlag[]).map((f) => [f.id, f]));
  for (const flag of (doc.lintFlags ?? []) as LintFlag[]) {
    const prev = before.get(flag.id);
    if (!flag.resolution || (prev && resolutionKey(prev) === resolutionKey(flag))) continue;
    const fixed = flag.resolution.action === "fixed";
    await writeAudit(req, {
      form,
      action: fixed ? "flag_fixed" : "flag_rejected",
      details: fixed ? `Poprawiono: ${flag.title}.` : `Odrzucono uwagę „${flag.title}”: ${flag.resolution.justification ?? "bez uzasadnienia"}.`,
    });
  }

  const changed = JSON.stringify(doc.schema) !== JSON.stringify(previousDoc?.schema) || doc.title !== previousDoc?.title;
  if (changed) await writeAudit(req, { form, action: "field_edited", details: "Zmieniono strukturę formularza." });
  else if (doc.status !== previousDoc?.status && doc.status === "in_review") {
    await writeAudit(req, { form, action: "field_edited", details: "Przekazano formularz do weryfikacji." });
  }
  return doc;
};
