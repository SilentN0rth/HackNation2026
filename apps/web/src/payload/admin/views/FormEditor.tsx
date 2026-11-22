import type { AdminViewServerProps } from "payload";
import type { StatuteChunk } from "@/types";
import { EditorClient } from "./editor/EditorClient";
import { Gutter, PanelPage, toFormDoc } from "./lib/server";
import { EditorMissing } from "./editor/EditorMissing";

export async function FormEditor(props: AdminViewServerProps) {
  const { req } = props.initPageResult;
  const segments = Array.isArray(props.params?.segments) ? props.params.segments : [];
  const id = Number(segments[1]);

  let content: React.ReactNode = <EditorMissing />;
  if (req.user && Number.isInteger(id) && id > 0) {
    const [form, chunks] = await Promise.all([
      req.payload.findByID({ collection: "forms", id, draft: true, depth: 1, req, overrideAccess: false, user: req.user }).catch(() => null),
      req.payload.find({ collection: "statute-chunks", limit: 500, depth: 0, req, overrideAccess: false, user: req.user }),
    ]);
    if (form) {
      const statute: StatuteChunk[] = chunks.docs.map((d) => ({ id: String(d.chunkId), act: String(d.act), unit: String(d.unit), text: String(d.text) }));
      content = <EditorClient initial={toFormDoc(form as never)} chunks={statute} userName={String((req.user as { name?: string }).name ?? "")} />;
    }
  }

  return (
    <PanelPage props={props}>
      <Gutter>{content}</Gutter>
    </PanelPage>
  );
}
