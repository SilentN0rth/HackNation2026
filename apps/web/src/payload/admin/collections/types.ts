/** Serializowalne dane przekazywane z widoków serwerowych do klienckich (HeroUI). */
import type { CollectionViewConfig, Tone } from "./config";

export type ColumnKind = "text" | "status" | "date" | "number" | "relation" | "upload" | "boolean" | "json" | "filesize" | "mime" | "email" | "id";

export type ColumnDef = { name: string; label: string; kind: ColumnKind; sortable: boolean; active: boolean };

export type CellValue = { text: string; tone?: Tone; href?: string; thumb?: string; mono?: boolean } | null;

export type ListRow = {
  id: string | number;
  title: string;
  href: string;
  cells: Record<string, CellValue>;
  status?: { label: string; tone: Tone };
  /** Wpis osi czasu (dziennik decyzji). */
  timeline?: { actor: string; initials: string; date: string; details: string; link?: { label: string; href: string } };
  /** Kafelek siatki (pliki). */
  file?: { thumb?: string; mime: string; ext: string; size: string; date: string; url?: string };
  /** Podgląd dla obywatela (opublikowane formularze). */
  previewHref?: string;
};

export type FilterDef = { name: string; label: string; options: { value: string; label: string }[] };

export type ListViewData = {
  slug: string;
  singular: string;
  plural: string;
  config: CollectionViewConfig;
  columns: ColumnDef[];
  rows: ListRow[];
  filters: FilterDef[];
  page: number;
  totalPages: number;
  totalDocs: number;
  limit: number;
  canCreate: boolean;
  canDelete: boolean;
  newHref: string;
  apiRoute: string;
  adminRoute: string;
};
