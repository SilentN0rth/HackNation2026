import type { CollectionConfig, Config, Field, GlobalConfig, PayloadComponent } from "payload";

type AdminConfig = NonNullable<Config["admin"]>;

export type AdminComponents = NonNullable<AdminConfig["components"]>;

export type AdminOptions = Omit<AdminConfig, "components" | "user" | "importMap" | "routes">;

export type CollectionSlug = "users" | "media" | "forms" | "audit-log" | "applications" | "statute-chunks";
export type GlobalSlug = "settings" | "registry";

export type CollectionOverride = { admin?: CollectionConfig["admin"] };
export type GlobalOverride = { admin?: GlobalConfig["admin"] };

export type FieldComponents = Partial<Record<"Field" | "Cell" | "Label" | "Description" | "Error" | "Filter" | "beforeInput" | "afterInput", PayloadComponent | PayloadComponent[]>>;

export type FieldType = Field["type"];

export type FieldComponentMap = {
  byType?: Partial<Record<FieldType, FieldComponents>>;
  byPath?: Record<string, FieldComponents>;
};

export type PanelFragment = {
  components?: AdminComponents;
  admin?: AdminOptions;
  collections?: Partial<Record<CollectionSlug, CollectionOverride>>;
  globals?: Partial<Record<GlobalSlug, GlobalOverride>>;
  fields?: FieldComponentMap;
};
