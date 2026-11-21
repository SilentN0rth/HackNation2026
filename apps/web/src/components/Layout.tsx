"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api, USE_MOCKS } from "@/api";
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

/** Link nawigacji z `aria-current="page"` przy dokładnym dopasowaniu ścieżki. */
function NavLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  const pathname = usePathname();
  return (
    <Link href={href} className={className} aria-current={pathname === href ? "page" : undefined}>
      {children}
    </Link>
  );
}

export function Wordmark() {
  return (
    <Link href="/" className="press flex items-center gap-2.5" aria-label="e-Formularze, strona główna">
      <span aria-hidden className="grid size-7 place-items-center rounded-[5px] bg-accent text-[15px] font-bold text-white">
        e
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Formularze</span>
    </Link>
  );
}

function RoleSwitch({ role }: { role: Role }) {
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

function Header() {
  const pathname = usePathname();
  const role: Role = pathname.startsWith("/citizen") ? "citizen" : "official";
  const [userName, setUserName] = useState("");

  useEffect(() => {
    let live = true;
    api.getCurrentUser(role).then((u) => live && setUserName(u.name));
    return () => {
      live = false;
    };
  }, [role]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Wordmark />
        <nav aria-label="Główna nawigacja" className="hidden h-full items-stretch gap-7 md:flex">
          {NAV[role].map((item) => (
            <NavLink
              key={item.to}
              href={item.to}
              className="nav-link flex items-center text-[15px] font-medium"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          {userName && <span className="hidden text-sm text-ink-3 lg:inline">{userName}</span>}
          <RoleSwitch role={role} />
        </div>
      </div>
      <nav aria-label="Nawigacja mobilna" className="flex gap-6 overflow-x-auto border-t border-border px-5 md:hidden">
        {NAV[role].map((item) => (
          <NavLink key={item.to} href={item.to} className="nav-link py-3 text-sm font-medium whitespace-nowrap">
            {item.label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 bg-ink text-white/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-3">
          <p className="text-lg font-semibold text-white">e-Formularze</p>
          <p className="max-w-sm text-sm leading-relaxed">
            Zamiana papierowych formularzy urzędowych na e‑usługi. Projekt na HackNation 2026, wyzwanie
            Centralnego Ośrodka Informatyki.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 text-sm">
          <p className="mb-1 font-semibold text-white">Urzędnik</p>
          <Link className="hover:text-white" href="/official">Formularze</Link>
          <Link className="hover:text-white" href="/official/upload">Nowy z pliku</Link>
          <Link className="hover:text-white" href="/official/audit">Dziennik decyzji</Link>
        </div>
        <div className="flex flex-col gap-2.5 text-sm">
          <p className="mb-1 font-semibold text-white">Obywatel</p>
          <Link className="hover:text-white" href="/citizen">Usługi</Link>
          <Link className="hover:text-white" href="/citizen/applications">Twoje sprawy</Link>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-5 py-5 text-xs sm:px-8">
          <span>© 2026 e-Formularze</span>
          {USE_MOCKS && <span className="text-white/50">Dane demonstracyjne</span>}
        </div>
      </div>
    </footer>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-white"
      >
        Przejdź do treści
      </a>
      <Header />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-5 pt-10 outline-none sm:px-8 sm:pt-14">
        {children}
      </main>
      <Footer />
    </div>
  );
}
