"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/api";
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
        <Link
          key={item.to}
          href={item.to}
          className={linkClassName}
          aria-current={pathname === item.to ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function UserName() {
  const role = useRole();
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let live = true;
    api.getCurrentUser(role).then((u) => live && setUserName(u.name));
    return () => {
      live = false;
    };
  }, [role]);

  return userName ? <span className="hidden text-sm text-ink-3 lg:inline">{userName}</span> : null;
}

export function RoleSwitch() {
  const role = useRole();
  const items: { role: Role; to: string; label: string }[] = [
    { role: "official", to: "/official", label: "Urzędnik" },
    { role: "citizen", to: "/citizen", label: "Obywatel" },
  ];
  return (
    <div role="group" aria-label="Widok" className="flex items-center rounded-md bg-default p-0.5 text-sm">
      {items.map((it) => {
        const active = it.role === role;
        return (
          <Link
            key={it.role}
            href={it.to}
            aria-current={active ? "true" : undefined}
            className={`press rounded-[5px] px-3 py-1.5 font-medium transition-colors duration-150 ${
              active ? "bg-white text-ink shadow-[0_1px_2px_rgba(13,14,14,0.08)]" : "text-ink-3 hover:text-ink"
            }`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}
