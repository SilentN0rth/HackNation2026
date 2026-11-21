/**
 * Fragment: WIDOKI DOMENOWE (agent E). Edytuje tylko agent E.
 * Tu: components.views (dashboard, własne widoki z path), linki w nawigacji, edytor formularza
 * i dziennik decyzji (też jako widok listy kolekcji audit-log). Kształt: PanelFragment z ./types.ts.
 * Adresy: admin/views/routes.ts (PANEL_VIEWS dla nawigacji agenta B).
 */
import { VIEW_PATHS } from "../views/routes";
import type { PanelFragment } from "./types";

const V = "@/payload/admin/views";

export const fragment: PanelFragment = {
  components: {
    views: {
      // Pulpit: statystyki, ostatnie formularze, dziennik i skróty; po zalogowaniu szanuje settings.defaultView.
      dashboard: { Component: `${V}/Dashboard#Dashboard` },
      // /official/upload – nowy formularz z pliku (wymaga usunięcia przekierowania /official/upload z next.config).
      formUpload: { Component: `${V}/Upload#Upload`, path: VIEW_PATHS.upload, exact: true, meta: { title: "Nowy z pliku" } },
      // /official/forms/:id/editor – edytor struktury, uwag i publikacji.
      formEditor: { Component: `${V}/FormEditor#FormEditor`, path: VIEW_PATHS.editor, exact: true, meta: { title: "Edytor formularza" } },
      // /official/audit – dziennik decyzji (wymaga usunięcia przekierowania /official/audit z next.config).
      audit: { Component: `${V}/Audit#Audit`, path: VIEW_PATHS.audit, exact: true, meta: { title: "Dziennik decyzji" } },
    },
    beforeNavLinks: [`${V}/NavLinks#NavLinks`],
  },
  collections: {
    forms: {
      admin: { components: { edit: { beforeDocumentControls: [`${V}/FormDocLinks#FormDocLinks`] } } },
    },
    // Oś czasu z filtrami zamiast tabeli także pod /official/collections/audit-log.
    "audit-log": {
      admin: { components: { views: { list: { Component: `${V}/AuditList#AuditList` } } } },
    },
  },
};
