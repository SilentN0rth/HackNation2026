/** Konfiguracja widoków kolekcji (wspólna dla serwera i klienta – same dane, bez funkcji). */

export type Tone = "neutral" | "accent" | "success" | "warning" | "danger";
export type ListMode = "table" | "timeline" | "grid";

export type CollectionViewConfig = {
  /** Opis pod nagłówkiem listy. */
  description: string;
  /** Pole select pokazywane jako chip statusu (w liście i nagłówku dokumentu). */
  statusField?: string;
  tones?: Record<string, Tone>;
  /** Tryby listy – pierwszy jest domyślny. */
  modes?: ListMode[];
  /** Akcja masowa „Opublikuj” (formularze). */
  bulkPublish?: boolean;
  /** Tylko do odczytu – bez tworzenia, zaznaczania i usuwania (dziennik decyzji). */
  readOnly?: boolean;
  /** Pola select, po których można filtrować. */
  filters?: string[];
  /** Grupa w okruszkach. */
  group?: string;
};

export const VIEW_CONFIG: Record<string, CollectionViewConfig> = {
  forms: {
    description: "Wersje robocze i opublikowane e-usługi. Każda zmiana trafia do dziennika decyzji.",
    statusField: "status",
    tones: { draft: "neutral", in_review: "warning", published: "success" },
    bulkPublish: true,
    filters: ["status", "aiStatus"],
  },
  applications: {
    description: "Wnioski złożone przez obywateli w opublikowanych e-usługach.",
    statusField: "status",
    tones: { draft: "neutral", sent: "accent", accepted: "success" },
    filters: ["status"],
  },
  "audit-log": {
    description: "Kto, kiedy i na jakiej podstawie zatwierdził zmianę. Wpisy tworzy system – nie można ich edytować.",
    statusField: "action",
    tones: {
      upload: "neutral",
      draft_generated: "accent",
      linters_run: "accent",
      field_edited: "neutral",
      flag_fixed: "success",
      flag_rejected: "warning",
      published: "success",
    },
    modes: ["timeline", "table"],
    readOnly: true,
    filters: ["action"],
  },
  media: {
    description: "Wgrane blankiety: PDF, DOC, DOCX, ODS, XLSX, JPG i PNG. Typ pliku sprawdzamy po zawartości.",
    modes: ["grid", "table"],
  },
  users: {
    description: "Konta urzędników i administratorów panelu.",
    statusField: "role",
    tones: { official: "neutral", admin: "accent" },
    filters: ["role"],
  },
  "statute-chunks": {
    description: "Jednostki redakcyjne ustaw – podstawy prawne pól formularzy.",
  },
  settings: { description: "Preferencje panelu: gęstość, motyw, widok startowy i animacje." },
  registry: { description: "Dane „z rejestrów” do wstępnego wypełniania formularzy obywatela (makieta)." },
};

export const viewConfig = (slug: string): CollectionViewConfig => VIEW_CONFIG[slug] ?? { description: "" };

export const PER_PAGE = [10, 25, 50, 100];
