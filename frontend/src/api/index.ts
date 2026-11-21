import type { Api } from "./types";
import { mockApi } from "./mockApi";
import { httpApi } from "./httpApi";

export const USE_MOCKS = (import.meta.env.VITE_USE_MOCKS ?? "true") !== "false";

export const api: Api = USE_MOCKS ? mockApi : httpApi;

export * from "./types";
