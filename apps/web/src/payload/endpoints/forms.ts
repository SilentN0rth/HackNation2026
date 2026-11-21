/** Endpointy kolekcji forms: /api/payload/forms/:id/lint i /api/payload/forms/:id/generate. */
import type { Endpoint, PayloadHandler, PayloadRequest } from "payload";
import type { FormSchema, LintFlag } from "../../types";
import { writeAudit } from "../hooks/audit";
import { FastApiError, relintDraft } from "../hooks/fastapi";
import { fillFromSource } from "../hooks/forms";

const fail = (status: number, message: string) => Response.json({ errors: [{ message }] }, { status });

async function loadForm(req: PayloadRequest) {
  if (!req.user) return { error: fail(401, "Zaloguj się.") };
  const id = req.routeParams?.id as string | undefined;
  if (!id) return { error: fail(400, "Brak identyfikatora formularza.") };
  const form = await req.payload.findByID({ collection: "forms", id, req, draft: true, depth: 0 }).catch(() => null);
  if (!form) return { error: fail(404, "Nie ma takiego formularza.") };
  return { form };
}

/** Rozstrzygnięcia przetrwają ponowne uruchomienie linterów (deterministyczne id flag). */
function keepResolutions(next: LintFlag[], previous: LintFlag[]): LintFlag[] {
  const resolved = new Map(previous.filter((f) => f.resolution).map((f) => [f.id, f.resolution]));
  return next.map((f) => (resolved.has(f.id) ? { ...f, resolution: resolved.get(f.id) } : f));
}

const relint: PayloadHandler = async (req) => {
  const { form, error } = await loadForm(req);
  if (error) return error;
  if (!form.fastapiDraftId) return fail(409, "Formularz nie jest powiązany z silnikiem AI – wgraj plik źródłowy.");
  try {
    const { flags, coi } = await relintDraft(form.fastapiDraftId, form.schema as FormSchema | null);
    const lintFlags = keepResolutions(flags, (form.lintFlags ?? []) as LintFlag[]);
    const doc = await req.payload.update({
      collection: "forms",
      id: form.id,
      req,
      draft: true,
      data: { lintFlags, coiSource: coi as never, aiStatus: "ready", aiError: null },
      context: { skipAudit: true },
    });
    const errors = lintFlags.filter((f) => f.severity === "error").length;
    await writeAudit(req, { form: form.id, action: "linters_run", details: `Kontrola jakości: ${lintFlags.length} uwag, w tym ${errors} krytycznych.` });
    return Response.json(doc);
  } catch (e) {
    return fail(e instanceof FastApiError && e.unavailable ? 503 : 502, e instanceof Error ? e.message : String(e));
  }
};

const regenerate: PayloadHandler = async (req) => {
  const { form, error } = await loadForm(req);
  if (error) return error;
  if (!form.source) return fail(409, "Formularz nie ma pliku źródłowego.");
  const filled = await fillFromSource(req, { title: form.title, source: form.source as number });
  const doc = await req.payload.update({
    collection: "forms",
    id: form.id,
    req,
    draft: true,
    data: filled as never,
    context: { skipAI: true, skipAudit: true },
  });
  if (filled.aiStatus === "error") return fail(503, filled.aiError ?? "Silnik AI niedostępny.");
  const pages = (filled.schema as FormSchema | null)?.pages.length ?? 0;
  await writeAudit(req, { form: form.id, action: "draft_generated", system: true, details: `Wygenerowano formularz ponownie: ${pages} stron.`, aiOutputRef: filled.fastapiDraftId });
  return Response.json(doc);
};

export const relintEndpoint: Endpoint = { path: "/:id/lint", method: "post", handler: relint };
export const regenerateEndpoint: Endpoint = { path: "/:id/generate", method: "post", handler: regenerate };
