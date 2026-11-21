/**
 * Fragment: WIDOKI DOMENOWE (agent E). Edytuje tylko agent E.
 * Tu: components.views (dashboard, własne widoki z path, np. /upload), beforeDashboard/afterDashboard,
 * collections.forms.admin.components.views.edit.<tab> (edytor formularza), collections["audit-log"] …
 * Kształt: PanelFragment z ./types.ts.
 */
import type { PanelFragment } from "./types";

export const fragment: PanelFragment = {
  components: {
    // Zaślepka etapu 0: potwierdza, że HeroUI + Tailwind działają w panelu. Agent E zastępuje dashboardem.
    beforeDashboard: ["@/payload/admin/views/HeroUIProbe#HeroUIProbe"],
  },
};
