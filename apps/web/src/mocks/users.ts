import type { User } from "../types";

export const users: Record<"official" | "citizen", User> = {
  official: { id: "u-official", name: "Anna Nowak", role: "official", initials: "AN" },
  citizen: { id: "u-citizen", name: "Jan Kowalski", role: "citizen", initials: "JK" },
};
