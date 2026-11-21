import type { Api } from "./types";
import { mockApi } from "./mockApi";
import { httpApi } from "./httpApi";

/**
 * JEDYNE miejsce, z którego komponenty biorą dane: `import { api } from "@/api"`.
 * Przełącznik: NEXT_PUBLIC_USE_MOCKS w pliku .env.local (domyślnie mocki).
 *
 * Mocki trzymają stan w pamięci przeglądarki, więc wołamy api wyłącznie
 * z komponentów klienckich ("use client").
 */
export const USE_MOCKS = (process.env.NEXT_PUBLIC_USE_MOCKS ?? "true") !== "false";

export const api: Api = USE_MOCKS ? mockApi : httpApi;

export * from "./types";
