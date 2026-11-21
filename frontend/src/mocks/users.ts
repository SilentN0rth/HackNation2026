import type { User } from "../types";

/** MOCK: zalogowani użytkownicy. Docelowo: GET /me (token JWT z węzła krajowego – makieta). */
export const users: Record<"official" | "citizen", User> = {
  official: { id: "u-official", name: "Anna Nowak", role: "official", initials: "AN" },
  citizen: { id: "u-citizen", name: "Jan Kowalski", role: "citizen", initials: "JK" },
};
