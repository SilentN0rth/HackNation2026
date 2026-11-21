import type { Api } from "./types";
import { mockApi } from "./mockApi";
import { httpApi } from "./httpApi";

export const USE_MOCKS = (process.env.NEXT_PUBLIC_USE_MOCKS ?? "false") === "true";

export const api: Api = USE_MOCKS ? mockApi : httpApi;

export * from "./types";
