"use client";

import { useAuth } from "@payloadcms/ui";

/** admin.avatar – inicjały użytkownika (pole initials kolekcji users) zamiast Gravatara. */
export function Avatar({ size = 28 }: { size?: number }) {
  const { user } = useAuth<{ initials?: string; name?: string; email: string }>();
  const initials = user?.initials || user?.name?.slice(0, 1) || user?.email?.slice(0, 1) || "?";
  return (
    <span
      aria-hidden
      style={{ width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent-soft-foreground"
    >
      {initials.toUpperCase()}
    </span>
  );
}
