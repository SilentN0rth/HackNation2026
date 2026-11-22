"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactNode } from "react";
import { Wordmark } from "./Logo";

export type NavGroup = { label: string; links: { href: string; label: string }[] };

type Props = {
  home: string;
  account: string;
  logout: string;
  userName: string;
  groups: NavGroup[];
  before?: ReactNode;
  after?: ReactNode;
};

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

function NavLink({ href, exact, children, className = "" }: { href: string; exact?: boolean; children: ReactNode; className?: string }) {
  const path = trim(usePathname());
  const target = trim(href);
  const active = exact ? path === target : path === target || path.startsWith(`${target}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`nav-link whitespace-nowrap ${className}`}>
      {children}
    </Link>
  );
}

export function NavBar({ home, account, logout, userName, groups, before, after }: Props) {
  return (
    <header className="ef-ui ef-nav sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 sm:px-8">
        <Wordmark href={home} />
        <span className="hidden text-sm font-medium text-ink-3 sm:inline">Panel urzędnika</span>
        <div className="ml-auto flex min-w-0 items-center gap-4 text-sm sm:gap-5">
          <Link href="/" className="hidden text-ink-3 transition-colors duration-150 hover:text-ink md:inline">
            Strona publiczna
          </Link>
          <NavLink href={account} className="inline-block max-w-[9rem] truncate py-5 font-medium sm:max-w-none">
            {userName}
          </NavLink>
          <Link href={logout} className="press rounded-md bg-default px-3 py-1.5 font-medium text-ink transition-colors duration-150 hover:bg-default-hover">
            Wyloguj
          </Link>
        </div>
      </div>
      <nav aria-label="Panel urzędnika" className="nav-strip bg-accent">
        <div className="mx-auto flex max-w-7xl flex-wrap items-stretch gap-x-5 px-5 text-[13px] font-medium sm:px-8">
          <NavLink href={home} exact className="flex items-center py-2.5">
            Pulpit
          </NavLink>
          {before}
          {groups.map((g) => (
            <Fragment key={g.label}>
              <span aria-hidden className="my-2.5 w-px shrink-0 bg-white/25" />
              <span className="sr-only">{g.label}:</span>
              {g.links.map((l) => (
                <NavLink key={l.href} href={l.href} className="flex items-center py-2.5">
                  {l.label}
                </NavLink>
              ))}
            </Fragment>
          ))}
          {after}
        </div>
      </nav>
    </header>
  );
}
