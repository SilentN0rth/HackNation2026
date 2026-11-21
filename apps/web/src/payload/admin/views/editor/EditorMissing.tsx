"use client";

import { formsListUrl } from "../routes";
import { ArrowLink, PageHeader, ViewRoot } from "../ui/bits";

export function EditorMissing() {
  return (
    <ViewRoot testId="panel-editor-missing">
      <PageHeader eyebrow="Edytor formularza" title="Nie ma takiego formularza" description="Mógł zostać usunięty albo adres jest niepełny." />
      <ArrowLink href={formsListUrl()}>Wróć do listy formularzy</ArrowLink>
    </ViewRoot>
  );
}
