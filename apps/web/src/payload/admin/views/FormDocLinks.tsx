"use client";

import { useDocumentInfo } from "@payloadcms/ui";
import { uiScope } from "./motion";
import { editorUrl, uploadUrl } from "./routes";
import { ArrowLink, PanelRouter } from "./ui/bits";

export function FormDocLinks() {
  const { id } = useDocumentInfo();
  return (
    <PanelRouter>
      <span className={`${uiScope} inline-flex items-center`}>
        {id ? (
          <ArrowLink href={editorUrl(id)} className="text-sm">
            Edytor formularza
          </ArrowLink>
        ) : (
          <ArrowLink href={uploadUrl()} className="text-sm">
            Nowy z pliku
          </ArrowLink>
        )}
      </span>
    </PanelRouter>
  );
}
