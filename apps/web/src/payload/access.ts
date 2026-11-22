import type { Access, FieldAccess } from "payload";

export const loggedIn: Access = ({ req }) => Boolean(req.user);

export const adminOnly: Access = ({ req }) => req.user?.role === "admin";

export const adminOrSelf: Access = ({ req }) => {
  if (!req.user) return false;
  if (req.user.role === "admin") return true;
  return { id: { equals: req.user.id } };
};

export const adminOnlyField: FieldAccess = ({ req }) => req.user?.role === "admin";

export const nobody: Access = () => false;

export const anyone: Access = () => true;
