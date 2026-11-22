import type { AdminViewServerProps } from "payload";
import { AuditList } from "./AuditList";
import { PanelPage } from "./lib/server";

export function Audit(props: AdminViewServerProps) {
  const { req } = props.initPageResult;
  return (
    <PanelPage props={props}>
      <AuditList payload={req.payload} user={req.user} searchParams={props.searchParams as Record<string, string | string[] | undefined>} />
    </PanelPage>
  );
}
