import { randomBytes } from "node:crypto";
import type { Endpoint } from "payload";
import { generatePayloadCookie } from "payload/shared";

export const DEMO_EMAIL = "demo.urzednik@example.gov.pl";

export const demoLoginEnabled = () => process.env.DEMO_LOGIN === "true";

/**
 * Logowanie jednym kliknięciem na wersji demonstracyjnej (DEMO_LOGIN=true). Konto ma rolę urzędnika, nie administratora,
 * a hasło jest losowane przy każdym wejściu i nigdy nie opuszcza serwera – nie ma czego wyciec do przeglądarki ani repozytorium.
 */
export const demoLoginEndpoint: Endpoint = {
  path: "/demo-login",
  method: "post",
  handler: async (req) => {
    if (!demoLoginEnabled()) return Response.json({ errors: [{ message: "Nie znaleziono." }] }, { status: 404 });
    const { payload } = req;
    const password = randomBytes(24).toString("base64url");
    const found = await payload.find({ collection: "users", where: { email: { equals: DEMO_EMAIL } }, limit: 1, overrideAccess: true });
    const existing = found.docs[0];
    if (existing) {
      await payload.update({ collection: "users", id: existing.id, data: { password, role: "official" }, overrideAccess: true });
    } else {
      await payload.create({
        collection: "users",
        data: { email: DEMO_EMAIL, password, name: "Urzędnik (demo)", role: "official" },
        overrideAccess: true,
      });
    }
    const result = await payload.login({ collection: "users", data: { email: DEMO_EMAIL, password }, req });
    const users = payload.collections.users.config;
    const cookie = generatePayloadCookie({ collectionAuthConfig: users.auth, cookiePrefix: payload.config.cookiePrefix, token: result.token! });
    return Response.json(
      { message: "Zalogowano.", user: result.user, token: result.token, exp: result.exp },
      { headers: { "Set-Cookie": cookie } },
    );
  },
};
