/**
 * Seed danych demonstracyjnych z src/mocks: `npm run payload:seed`. Idempotentny – uruchomiony ponownie
 * niczego nie dubluje (użytkownik po e-mailu, formularze po slug, przepisy po chunkId, wnioski tylko do pustej kolekcji, rejestr gdy pusty).
 */
import { getPayload, type Payload } from "payload";
import config from "../../payload.config";
import { applications, auditTrail, drafts, prefillData, publishedForms, runMockLinters, statuteChunks, users } from "../../mocks";
import type { FormsContext } from "../hooks/forms";

export const SEED_EMAIL = "urzednik@example.gov.pl";
const context: FormsContext = { skipAI: true, skipAudit: true };

function seedPassword(): string {
  if (process.env.SEED_PASSWORD) return process.env.SEED_PASSWORD;
  if (process.env.NODE_ENV === "production") throw new Error("Ustaw SEED_PASSWORD przed seedowaniem produkcji.");
  return "demo1234";
}

async function seedUser(payload: Payload): Promise<number> {
  const found = await payload.find({ collection: "users", where: { email: { equals: SEED_EMAIL } }, limit: 1 });
  if (found.docs[0]) return found.docs[0].id;
  const { name, initials } = users.official;
  const user = await payload.create({
    collection: "users",
    data: { email: SEED_EMAIL, password: seedPassword(), name, initials, role: "official" },
  });
  payload.logger.info(`seed: utworzono konto ${SEED_EMAIL}`);
  return user.id;
}

async function findFormId(payload: Payload, slug: string): Promise<number | undefined> {
  const found = await payload.find({ collection: "forms", where: { slug: { equals: slug } }, limit: 1, draft: true, depth: 0 });
  return found.docs[0]?.id;
}

/** Zwraca mapę „id z makiet” → id w Payloadzie oraz listę formularzy utworzonych w tym przebiegu. */
async function seedForms(payload: Payload, userId: number) {
  const ids = new Map<string, number>();
  const created = new Set<number>();

  for (const draft of drafts) {
    const slug = draft.schema.id;
    let id = await findFormId(payload, slug);
    if (!id) {
      const doc = await payload.create({
        collection: "forms",
        context,
        draft: true,
        data: {
          title: draft.schema.title,
          slug,
          status: draft.status === "review" ? "in_review" : "draft",
          schema: draft.schema,
          lintFlags: draft.schema.pages.length ? runMockLinters(draft.schema, statuteChunks) : [],
          version: draft.schema.version,
          aiStatus: draft.status === "processing" ? "idle" : "ready",
          _status: "draft",
        },
      });
      id = doc.id;
      created.add(id);
    }
    ids.set(draft.id, id);
  }

  for (const form of publishedForms) {
    const slug = form.schema.id;
    let id = await findFormId(payload, slug);
    if (!id) {
      const doc = await payload.create({
        collection: "forms",
        context,
        data: {
          title: form.schema.title,
          slug,
          status: "published",
          schema: form.schema,
          lintFlags: [],
          summary: form.summary,
          estimatedMinutes: form.estimatedMinutes,
          version: form.version,
          publishedAt: form.publishedAt,
          publishedBy: userId,
          publishedByName: form.publishedBy,
          aiStatus: "ready",
          _status: "published",
        },
      });
      id = doc.id;
      created.add(id);
    }
    ids.set(form.id, id);
    ids.set(form.draftId, id);
  }
  return { ids, created };
}

async function seedAudit(payload: Payload, ids: Map<string, number>, created: Set<number>, userId: number) {
  for (const entry of auditTrail) {
    const form = ids.get(entry.draftId);
    if (!form || !created.has(form)) continue;
    const system = entry.userId === "system";
    await payload.create({
      collection: "audit-log",
      data: {
        form,
        user: system ? null : userId,
        actorName: entry.userName,
        action: entry.action,
        details: entry.details,
        aiOutputRef: entry.aiOutputRef ?? null,
        createdAt: new Date(entry.at).toISOString(),
      },
    });
  }
}

async function seedStatute(payload: Payload) {
  for (const chunk of statuteChunks) {
    const found = await payload.find({ collection: "statute-chunks", where: { chunkId: { equals: chunk.id } }, limit: 1 });
    if (found.docs[0]) continue;
    await payload.create({ collection: "statute-chunks", data: { chunkId: chunk.id, act: chunk.act, unit: chunk.unit, text: chunk.text } });
  }
}

async function seedApplications(payload: Payload, ids: Map<string, number>) {
  const { totalDocs } = await payload.count({ collection: "applications" });
  if (totalDocs > 0) return;
  for (const app of applications) {
    const form = ids.get(app.formId);
    if (!form) continue;
    await payload.create({
      collection: "applications",
      data: { form, formTitle: app.formTitle, status: app.status, values: app.values, confirmationNo: app.confirmationNo ?? null },
    });
  }
}

async function seedRegistry(payload: Payload) {
  const registry = await payload.findGlobal({ slug: "registry" });
  const current = registry.prefill;
  if (current && typeof current === "object" && Object.keys(current).length > 0) return;
  await payload.updateGlobal({ slug: "registry", data: { prefill: prefillData } });
}

export async function seed(payload: Payload) {
  const userId = await seedUser(payload);
  const { ids, created } = await seedForms(payload, userId);
  await seedAudit(payload, ids, created, userId);
  await seedStatute(payload);
  await seedApplications(payload, ids);
  await seedRegistry(payload);
  payload.logger.info(`seed: gotowe (nowe formularze: ${created.size}). Logowanie: ${SEED_EMAIL}`);
}

const payload = await getPayload({ config });
try {
  await seed(payload);
} finally {
  await payload.destroy();
}
process.exit(0);
