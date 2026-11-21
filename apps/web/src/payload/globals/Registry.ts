import type { GlobalConfig } from "payload";
import { loggedIn } from "../access";

/** Dane „z rejestrów” do prefillu (makieta mObywatel / CEIDG). Obywatel czyta je przez /api/payload/prefill. */
export const Registry: GlobalConfig = {
  slug: "registry",
  label: "Rejestry (demo)",
  admin: { group: "Administracja" },
  access: { read: loggedIn, update: loggedIn },
  fields: [
    {
      name: "prefill",
      label: "Dane do prefillu",
      type: "json",
      defaultValue: {},
      admin: { description: "Klucz → wartość, np. person.fullName. Klucze odpowiadają Field.prefill.key." },
    },
  ],
};
