import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { InitPageResult } from "payload";
import { countOpen } from "@/lib/lint";
import { DashboardClient, type DashboardData } from "./DashboardClient";
import { Gutter, toAuditItem, toFormDoc } from "./lib/server";
import { auditUrl, formsListUrl } from "./routes";

const START: Record<string, string> = { forms: formsListUrl(), "audit-log": auditUrl() };

async function startRedirect(initPageResult: InitPageResult) {
  const { req } = initPageResult;
  const referer = (await headers()).get("referer");
  const loginPath = `${req.payload.config.routes.admin}${req.payload.config.admin.routes.login}`;
  if (!referer || new URL(referer, "http://x").pathname !== loginPath) return;
  const settings = await req.payload.findGlobal({ slug: "settings", depth: 0, req, overrideAccess: false, user: req.user }).catch(() => null);
  const target = settings?.defaultView ? START[settings.defaultView] : undefined;
  if (target) redirect(target);
}

export async function Dashboard({ initPageResult }: { initPageResult: InitPageResult }) {
  await startRedirect(initPageResult);
  const { req } = initPageResult;
  const { payload, user } = req;

  const [forms, applications, audit, auditTotal] = await Promise.all([
    payload.find({ collection: "forms", draft: true, depth: 1, limit: 500, sort: "-updatedAt", req, overrideAccess: false, user }),
    payload.count({ collection: "applications", req, overrideAccess: false, user }),
    payload.find({ collection: "audit-log", depth: 0, limit: 6, sort: "-createdAt", req, overrideAccess: false, user }),
    payload.count({ collection: "audit-log", req, overrideAccess: false, user }),
  ]);

  const docs = forms.docs.map((d) => toFormDoc(d as never));
  const titles = new Map(docs.map((d) => [d.id, d.title]));
  const by = (s: string) => docs.filter((d) => d.status === s).length;

  const data: DashboardData = {
    userName: (user as { name?: string } | null)?.name ?? "",
    stats: {
      draft: by("draft"),
      inReview: by("in_review"),
      published: by("published"),
      criticalOpen: docs.reduce((n, d) => n + countOpen(d.lintFlags).errors, 0),
      applications: applications.totalDocs,
      audit: auditTotal.totalDocs,
    },
    recent: docs.slice(0, 5).map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      aiStatus: d.aiStatus,
      sourceName: d.sourceName,
      updatedAt: d.updatedAt,
      open: countOpen(d.lintFlags),
    })),
    formsTotal: docs.length,
    audit: audit.docs.map((d) => toAuditItem(d as never, titles)),
  };

  return (
    <Gutter>
      <DashboardClient data={data} />
    </Gutter>
  );
}
