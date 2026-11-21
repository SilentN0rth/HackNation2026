import type { Access, FieldAccess } from "payload";

/** Dowolny zalogowany urzędnik. */
export const loggedIn: Access = ({ req }) => Boolean(req.user);

/** Tylko administrator. */
export const adminOnly: Access = ({ req }) => req.user?.role === "admin";

/** Administrator albo właściciel konta. */
export const adminOrSelf: Access = ({ req }) => {
  if (!req.user) return false;
  if (req.user.role === "admin") return true;
  return { id: { equals: req.user.id } };
};

export const adminOnlyField: FieldAccess = ({ req }) => req.user?.role === "admin";

/** Zablokowane dla API – dokumenty tworzą wyłącznie hooki (Local API z overrideAccess). */
export const nobody: Access = () => false;

/** Publiczne (obywatel bez logowania – makieta węzła krajowego). */
export const anyone: Access = () => true;
