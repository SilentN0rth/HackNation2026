import type { GlobalConfig } from "payload";
import { loggedIn } from "../access";

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
      admin: { description: "Klucz ŹRÓDŁO.atrybut → wartość, np. PESEL.name. Źródła: PESEL, PESEL_ADDRESS, MLPZ. Brak klucza lub pusta wartość = pole zostaje puste." },
    },
  ],
};
