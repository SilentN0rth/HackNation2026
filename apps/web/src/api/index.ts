import type { Api } from "./types";
import { payloadApi } from "./payloadApi";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

/** Api ładowane leniwie przy pierwszym wywołaniu – makiety trafiają do osobnego chunka. */
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

// Warunek wprost na process.env – Next wstawia stałą w buildzie, więc przy mocks=false
// gałąź z import() znika i makiety (src/mocks) nie trafiają do paczki klienta.
// Bez makiet dane idą przez REST Payloada (/api/payload); httpApi (FastAPI wprost) zostaje jako alternatywa.
export const api: Api =
  process.env.NEXT_PUBLIC_USE_MOCKS === "true" ? lazyApi(() => import("./mockApi").then((m) => m.mockApi)) : payloadApi;

export * from "./types";
