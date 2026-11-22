import type { Endpoint } from "payload";
import { FormSchemaSchema, PrefillDataSchema } from "../../types";

export const prefillEndpoint: Endpoint = {
  path: "/prefill",
  method: "get",
  handler: async (req) => {
    const registry = await req.payload.findGlobal({ slug: "registry", req, overrideAccess: true });
    const data = PrefillDataSchema.safeParse(registry.prefill);
    if (!data.success) return Response.json({});

    const formId = typeof req.query.formId === "string" ? req.query.formId : "";
    const form = formId
      ? await req.payload.findByID({ collection: "forms", id: formId, req, overrideAccess: false, depth: 0 }).catch(() => null)
      : null;
    const schema = FormSchemaSchema.safeParse(form?.schema);
    if (!schema.success) return Response.json({});
    const keys = new Set(schema.data.pages.flatMap((p) => p.fields.flatMap((f) => (f.prefill ? [f.prefill.key] : []))));
    return Response.json(Object.fromEntries(Object.entries(data.data).filter(([key]) => keys.has(key))));
  },
};
