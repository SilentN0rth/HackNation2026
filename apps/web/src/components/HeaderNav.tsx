"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/types";

const NAV: Record<Role, { to: string; label: string }[]> = {
  official: [
    { to: "/official", label: "Formularze" },
    { to: "/official/upload", label: "Nowy z pliku" },
    { to: "/official/audit", label: "Dziennik decyzji" },
  ],
  citizen: [
    { to: "/citizen", label: "Usługi" },
    { to: "/citizen/applications", label: "Twoje sprawy" },
  ],
};

function useRole(): Role {
  return usePathname().startsWith("/citizen") ? "citizen" : "official";
}

export function NavLinks({ label, className, linkClassName }: { label: string; className: string; linkClassName: string }) {
  const pathname = usePathname();
  const role = useRole();
  return (
    <nav aria-label={label} className={className}>
      {NAV[role].map((item) => (
        <Link key={item.to} href={item.to} className={linkClassName} aria-current={pathname === item.to ? "page" : undefined}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function RoleSwitch() {
  const role = useRole();
  const items = [
    { role: "official", to: "/official", label: "Urzędnik" },
    { role: "citizen", to: "/citizen", label: "Obywatel" },
  ] as const;
  const activeIndex = items.findIndex((item) => item.role === role);
  return (
    <div role="group" aria-label="Widok" className="relative flex rounded-md bg-default p-0.5 text-sm">
      <span
        aria-hidden
        style={{ transform: `translateX(${activeIndex * 100}%)`, transitionTimingFunction: "var(--ease-out)" }}
        className="absolute inset-y-0.5 left-0.5 w-[calc(50%-0.125rem)] rounded-[5px] bg-white shadow-[0_1px_2px_rgba(13,14,14,0.08)] transition-transform duration-200"
      />
      {items.map((item) => {
        const active = item.role === role;
        return (
          <Link
            key={item.role}
            href={item.to}
            aria-current={active ? "true" : undefined}
            className={`relative z-10 flex-1 rounded-[5px] px-3 py-1.5 text-center font-medium transition-colors duration-150 ${
              active ? "text-accent" : "text-ink-3 hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
