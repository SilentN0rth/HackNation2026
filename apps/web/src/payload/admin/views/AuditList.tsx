import type { Payload, TypedUser } from "payload";
import { AuditClient } from "./AuditClient";
import { Gutter, toAuditItem, toFormDoc } from "./lib/server";

type Props = { payload: Payload; user?: TypedUser | null; searchParams?: Record<string, string | string[] | undefined> };

export async function AuditList({ payload, user, searchParams }: Props) {
  const [entries, forms] = await Promise.all([
    payload.find({ collection: "audit-log", depth: 0, limit: 1000, sort: "-createdAt", overrideAccess: false, user }),
    payload.find({ collection: "forms", draft: true, depth: 0, limit: 500, select: { title: true }, overrideAccess: false, user }),
  ]);
  const titles = new Map(forms.docs.map((d) => toFormDoc(d as never)).map((d) => [d.id, d.title]));
  const items = entries.docs.map((d) => toAuditItem(d as never, titles));
  const form = typeof searchParams?.form === "string" ? searchParams.form : null;

  return (
    <Gutter>
      <AuditClient items={items} initialForm={form} />
    </Gutter>
  );
}
