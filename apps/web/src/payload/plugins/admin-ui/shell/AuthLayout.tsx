import type { ReactNode } from "react";
import { Wordmark } from "./Logo";

/** Układ ekranów bez zalogowania (logowanie, pierwsze konto, hasło): jak strona główna, bez kart i cieni. */
export function AuthLayout({ title, lead, children, aside }: { title: string; lead?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="ef-ui ef-auth flex min-h-dvh flex-col bg-white text-ink">
      <header className="border-b border-border">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-5 sm:px-8">
          <Wordmark href="/" />
        </div>
      </header>
      <main id="main" className="mx-auto grid w-full max-w-7xl flex-1 gap-12 px-5 pt-12 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-12">
        <div className="rise lg:col-span-5">
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-balance sm:text-5xl">{title}</h1>
          {lead && <p className="mt-4 max-w-md text-lg leading-relaxed text-ink-2">{lead}</p>}
          <div className="mt-10 border-t border-ink pt-8">{children}</div>
        </div>
        {aside && <aside className="hidden lg:col-span-6 lg:col-start-7 lg:block">{aside}</aside>}
      </main>
    </div>
  );
}
