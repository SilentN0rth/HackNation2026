"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Chip, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { api, USE_MOCKS } from "@/api";
import type { Role } from "@/types";

const NAV: Record<Role, { href: string; label: string }[]> = {
  official: [
    { href: "/official", label: "Formularze" },
    { href: "/official/upload", label: "Nowy formularz" },
    { href: "/official/audit", label: "Audit Trail" },
  ],
  citizen: [
    { href: "/citizen", label: "Usługi" },
    { href: "/citizen/applications", label: "Twoje sprawy" },
  ],
};

/** Nawigacja + przełącznik ról (makieta logowania przez węzeł krajowy). Rola wynika z adresu. */
export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const role: Role = pathname.startsWith("/citizen") ? "citizen" : "official";
  const [userName, setUserName] = useState("");

  useEffect(() => {
    api.getCurrentUser(role).then((u) => setUserName(u.name));
  }, [role]);

  return (
    <>
      <nav aria-label="Główna nawigacja" className="flex flex-wrap items-center gap-1">
        {NAV[role].map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active ? "bg-accent-soft text-accent-soft-foreground" : "text-foreground hover:bg-default"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {USE_MOCKS && (
          <Chip size="sm" variant="soft" color="warning" title="Dane z src/mocks">
            DANE TESTOWE
          </Chip>
        )}
        <ToggleButtonGroup
          aria-label="Widok"
          size="sm"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[role]}
          onSelectionChange={(keys) => {
            const next = [...keys][0] as Role | undefined;
            if (next && next !== role) router.push(next === "official" ? "/official" : "/citizen");
          }}
        >
          <ToggleButton id="official">Urzędnik</ToggleButton>
          <ToggleButton id="citizen">Obywatel</ToggleButton>
        </ToggleButtonGroup>
        {userName && <span className="text-sm text-muted">{userName}</span>}
      </div>
    </>
  );
}
