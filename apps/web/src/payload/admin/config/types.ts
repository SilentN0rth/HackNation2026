/**
 * Kontrakt fragmentów konfiguracji panelu (/official).
 *
 * Każdy agent edytuje WYŁĄCZNIE swój plik (theme.ts, shell.ts, collections.ts, fields.ts, views.ts)
 * i eksportuje z niego `const fragment: PanelFragment`. payload.config.ts skleja fragmenty
 * w kolejności theme → shell → collections → fields → views (patrz merge.ts):
 *   - tablice (providers, beforeDashboard, actions, …) są sklejane,
 *   - obiekty (graphics, views, edit, …) łączone rekurencyjnie, późniejszy fragment wygrywa przy kolizji,
 *   - komponent (string „ścieżka#Eksport” albo { path, … }) jest niepodzielny – nadpisywany w całości.
 *
 * Ścieżki komponentów: "@/payload/admin/<obszar>/Plik#Eksport" (alias z tsconfig). Po dodaniu komponentu
 * importMap generuje się po scaleniu gałęzi (`npm run payload:importmap`), nie w gałęziach agentów.
 */
import type { CollectionConfig, Config, Field, GlobalConfig, PayloadComponent } from "payload";

type AdminConfig = NonNullable<Config["admin"]>;

/** admin.components z konfiguracji Payloada (providers, graphics, views, header, logout, …). */
export type AdminComponents = NonNullable<AdminConfig["components"]>;

/** Pozostałe opcje admin (np. avatar, theme, meta.icons) – bez pól zarządzanych przez etap 0. */
export type AdminOptions = Omit<AdminConfig, "components" | "user" | "importMap" | "routes">;

export type CollectionSlug = "users" | "media" | "forms" | "audit-log" | "applications" | "statute-chunks";
export type GlobalSlug = "settings" | "registry";

/** Nadpisania widoku kolekcji: admin (components.views.list/edit, beforeList, defaultColumns, …). */
export type CollectionOverride = { admin?: CollectionConfig["admin"] };
export type GlobalOverride = { admin?: GlobalConfig["admin"] };

/** Komponenty jednego pola (Field, Cell, Label, Description, Error, …) – jak field.admin.components. */
export type FieldComponents = Partial<Record<"Field" | "Cell" | "Label" | "Description" | "Error" | "Filter" | "beforeInput" | "afterInput", PayloadComponent | PayloadComponent[]>>;

export type FieldType = Field["type"];

/**
 * Mapa komponentów pól (agent D):
 *   - byType: dla każdego pola danego typu we wszystkich kolekcjach i globalach,
 *   - byPath: dla konkretnego pola, klucz "<slug>.<ścieżka.pola>", np. "forms.title", "settings.theme".
 * Pierwszeństwo: byPath > komponenty zdefiniowane w samej kolekcji > byType. Pola typu "ui" są pomijane.
 */
export type FieldComponentMap = {
  byType?: Partial<Record<FieldType, FieldComponents>>;
  byPath?: Record<string, FieldComponents>;
};

export type PanelFragment = {
  /** Scalane z admin.components. */
  components?: AdminComponents;
  /** Scalane z resztą admin (meta, avatar, theme, dateFormat, …). */
  admin?: AdminOptions;
  /** Nadpisania admin dla kolekcji. */
  collections?: Partial<Record<CollectionSlug, CollectionOverride>>;
  /** Nadpisania admin dla globali. */
  globals?: Partial<Record<GlobalSlug, GlobalOverride>>;
  /** Komponenty pól. */
  fields?: FieldComponentMap;
};
