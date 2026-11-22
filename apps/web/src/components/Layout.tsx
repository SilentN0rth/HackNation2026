import Link from "next/link";
import type { ReactNode } from "react";
import { NavLinks, RoleSwitch } from "./HeaderNav";

function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path
        d="M11.8 7.6h5.4l4.2 4.2v10.6a2 2 0 0 1-2 2h-7.6a2 2 0 0 1-2-2V9.6a2 2 0 0 1 2-2Z"
        fill="#fff"
      />
      <rect x="12.9" y="14.1" width="6.2" height="1.9" rx="0.95" fill="currentColor" />
      <rect x="12.9" y="17.4" width="4.2" height="1.9" rx="0.95" fill="currentColor" />
    </svg>
  );
}

function LogoOutline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} role="img" aria-hidden focusable="false" fill="none">
      <rect x="1.4" y="1.4" width="29.2" height="29.2" rx="7.4" stroke="currentColor" strokeWidth="1.5" opacity="0.75" />
      <path
        d="M11.8 7.8h5.1l3.9 3.9v10.1a1.8 1.8 0 0 1-1.8 1.8h-7.2a1.8 1.8 0 0 1-1.8-1.8V9.6a1.8 1.8 0 0 1 1.8-1.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M12.9 14.6h6.2M12.9 17.8h4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Wordmark() {
  return (
    <Link href="/" className="press flex items-center gap-2.5" title="Strona główna">
      <Logo className="size-8 text-accent" />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">e-Formularze</span>
    </Link>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-5 sm:px-8">
        <Wordmark />
        <NavLinks
          label="Główna nawigacja"
          className="hidden h-full items-stretch gap-7 md:flex"
          linkClassName="nav-link flex items-center text-[15px] font-medium"
        />
        <div className="ml-auto flex items-center">
          <RoleSwitch />
        </div>
      </div>
      <NavLinks
        label="Nawigacja mobilna"
        className="flex gap-6 overflow-x-auto border-t border-border px-5 md:hidden"
        linkClassName="nav-link py-3 text-sm font-medium whitespace-nowrap"
      />
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 bg-accent text-white/75">
      <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-12 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <LogoOutline className="size-8 text-white" />
              <p className="text-lg font-semibold text-white">e-Formularze</p>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-white/70">
              Zamiana papierowych formularzy urzędowych na e‑usługi. Projekt na HackNation 2026, wyzwanie
              Centralnego Ośrodka Informatyki.
            </p>
          </div>
          <nav className="flex flex-col gap-3 text-sm">
            <p className="text-xs font-semibold tracking-wider text-white/50 uppercase">Urzędnik</p>
            <Link className="w-fit text-white/75 transition-colors hover:text-white" href="/official">Formularze</Link>
            <Link className="w-fit text-white/75 transition-colors hover:text-white" href="/official/upload">Nowy z pliku</Link>
            <Link className="w-fit text-white/75 transition-colors hover:text-white" href="/official/audit">Dziennik decyzji</Link>
          </nav>
          <nav className="flex flex-col gap-3 text-sm">
            <p className="text-xs font-semibold tracking-wider text-white/50 uppercase">Obywatel</p>
            <Link className="w-fit text-white/75 transition-colors hover:text-white" href="/citizen">Usługi</Link>
            <Link className="w-fit text-white/75 transition-colors hover:text-white" href="/citizen/applications">Twoje sprawy</Link>
          </nav>
        </div>
        <div className="mt-12 border-t border-white/15 pt-6 text-xs text-white/60">
          © 2026 e-Formularze
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
