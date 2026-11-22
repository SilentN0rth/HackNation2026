import type { Api } from "./types";
import { payloadApi } from "./payloadApi";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

function lazyApi(load: () => Promise<Api>): Api {
  let impl: Promise<Api> | undefined;
  return new Proxy({} as Api, {
    get: (_, method) =>
      async (...args: unknown[]) => {
        const target = await (impl ??= load());
        return (target[method as keyof Api] as (...a: unknown[]) => Promise<unknown>)(...args);
      },
  });
}

export const api: Api =
  process.env.NEXT_PUBLIC_USE_MOCKS === "true" ? lazyApi(() => import("./mockApi").then((m) => m.mockApi)) : payloadApi;

export * from "./types";
