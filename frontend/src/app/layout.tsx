import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import { AppHeader } from "@/components/AppHeader";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin", "latin-ext"] });

export const metadata: Metadata = {
  title: { default: "e-Formularze", template: "%s · e-Formularze" },
  description: "Cyfryzacja formularzy urzędowych z podstawą prawną każdego pola (HackNation 2026, COI).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" data-theme="light" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
        >
          Przejdź do treści
        </a>
        <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
            <Link href="/" className="text-lg font-bold tracking-tight text-accent">
              e-Formularze
            </Link>
            <Suspense fallback={null}>
              <AppHeader />
            </Suspense>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6">
          {children}
        </main>
      </body>
    </html>
  );
}
