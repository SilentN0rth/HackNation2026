import { VIEW_PATHS } from "../views/routes";
import type { PanelFragment } from "./types";

const V = "@/payload/admin/views";

export const fragment: PanelFragment = {
  components: {
    views: {
      dashboard: { Component: `${V}/Dashboard#Dashboard` },
      formUpload: { Component: `${V}/Upload#Upload`, path: VIEW_PATHS.upload, exact: true, meta: { title: "Nowy z pliku" } },
      formEditor: { Component: `${V}/FormEditor#FormEditor`, path: VIEW_PATHS.editor, exact: true, meta: { title: "Edytor formularza" } },
      audit: { Component: `${V}/Audit#Audit`, path: VIEW_PATHS.audit, exact: true, meta: { title: "Dziennik decyzji" } },
    },
    beforeNavLinks: [`${V}/NavLinks#NavLinks`],
  },
  collections: {
    forms: {
      admin: { components: { edit: { beforeDocumentControls: [`${V}/FormDocLinks#FormDocLinks`] } } },
    },
  },
};
