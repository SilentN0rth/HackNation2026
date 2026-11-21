/**
 * Adresy widoków domenowych panelu (agent E). Bez importów serwerowych – można używać w nawigacji (agent B)
 * i w komponentach klienckich.
 *
 * Uwaga: widoki /official/upload i /official/audit są osiągalne dopiero po usunięciu z next.config starych
 * przekierowań tych adresów do widoków kolekcji. Dziennik podmienia też widok listy kolekcji audit-log.
 */

export const ADMIN_ROUTE = "/official";

/** Ścieżki względem routes.admin – tak, jak wpisuje się je w admin.components.views.<klucz>.path. */
export const VIEW_PATHS = {
  upload: "/upload",
  editor: "/forms/:id/editor",
  audit: "/audit",
} as const;

export const panelUrl = (path = "") => `${ADMIN_ROUTE}${path}`;
export const uploadUrl = () => panelUrl(VIEW_PATHS.upload);
export const editorUrl = (id: number | string) => panelUrl(`/forms/${id}/editor`);
export const formsListUrl = () => panelUrl("/collections/forms");
export const auditUrl = (query?: { form?: number | string }) =>
  panelUrl(`${VIEW_PATHS.audit}${query?.form != null ? `?form=${query.form}` : ""}`);

export type PanelViewIcon = "home" | "upload" | "forms" | "history";

export type PanelView = {
  key: "dashboard" | "upload" | "forms" | "audit";
  /** Pełny adres (z /official). */
  path: string;
  label: string;
  icon: PanelViewIcon;
  /** Aktywny, gdy pathname zaczyna się od któregoś z prefiksów (dashboard: tylko dokładnie). */
  match: string[];
};

/** Linki do widoków agenta E dla nawigacji panelu (agent B renderuje je w Nav). */
export const PANEL_VIEWS: PanelView[] = [
  { key: "dashboard", path: panelUrl(), label: "Pulpit", icon: "home", match: [] },
  { key: "upload", path: uploadUrl(), label: "Nowy z pliku", icon: "upload", match: [uploadUrl()] },
  { key: "forms", path: formsListUrl(), label: "Formularze", icon: "forms", match: [formsListUrl(), panelUrl("/forms/")] },
  { key: "audit", path: auditUrl(), label: "Dziennik decyzji", icon: "history", match: [auditUrl(), panelUrl("/collections/audit-log")] },
];
