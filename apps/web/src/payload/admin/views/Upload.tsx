import type { AdminViewServerProps } from "payload";
import { Gutter, PanelPage } from "./lib/server";
import { UploadClient } from "./UploadClient";

export function Upload(props: AdminViewServerProps) {
  return (
    <PanelPage props={props}>
      <Gutter>
        <UploadClient />
      </Gutter>
    </PanelPage>
  );
}
