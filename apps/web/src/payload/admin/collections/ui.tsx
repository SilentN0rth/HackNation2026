"use client";

import { Breadcrumbs, Chip, I18nProvider, RouterProvider } from "@heroui/react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { uiScope } from "@/payload/plugins/admin-ui/theme";
import type { Tone } from "./config";
import { useRise } from "./motion";
import "./collections.css";

/** Korzeń każdego widoku kolekcji: tokeny strony, router Next dla linków HeroUI, polska lokalizacja. */
export function ViewRoot({ children, testId }: { children: ReactNode; testId?: string }) {
  const router = useRouter();
  return (
    <RouterProvider navigate={(href) => router.push(href)}>
      <I18nProvider locale="pl-PL">
        <div data-testid={testId} className={`${uiScope} hn-view mx-auto w-full max-w-7xl px-5 pt-8 pb-28 sm:px-8 sm:pt-12`}>
          {children}
        </div>
      </I18nProvider>
    </RouterProvider>
  );
}

export type Crumb = { label: string; href?: string };

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <Breadcrumbs aria-label="Ścieżka" className="mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted" separator={<span aria-hidden className="text-muted/50">/</span>}>
      {items.map((c, i) => (
        <Breadcrumbs.Item
          key={`${c.label}-${i}`}
          href={c.href}
          className={c.href ? "text-muted transition-colors duration-150 hover:text-ink" : "text-ink-2"}
        >
          {c.label}
        </Breadcrumbs.Item>
      ))}
    </Breadcrumbs>
  );
}

/** Nagłówek strony jak PageHeader na stronie głównej: okruszki, duży tytuł, opis, akcje. */
export function PageHeader({
  crumbs,
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  crumbs?: Crumb[];
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  const { item, list } = useRise();
  return (
    <motion.header variants={list} initial="hidden" animate="show" className="mb-10 sm:mb-12">
      {crumbs && (
        <motion.div variants={item} className="mb-6">
          <Crumbs items={crumbs} />
        </motion.div>
      )}
      <div className="flex flex-wrap items-end gap-6">
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <motion.p variants={item} className="mb-4 text-sm font-semibold tracking-wide text-accent uppercase">
              {eyebrow}
            </motion.p>
          )}
          <motion.h1
            variants={item}
            className="text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance break-words text-ink sm:text-5xl"
          >
            {title}
          </motion.h1>
          {meta && (
            <motion.div variants={item} className="mt-4 flex flex-wrap items-center gap-3">
              {meta}
            </motion.div>
          )}
          {description && (
            <motion.div variants={item} className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-muted">
              {description}
            </motion.div>
          )}
        </div>
        {actions && (
          <motion.div variants={item} className="flex flex-wrap items-center gap-3">
            {actions}
          </motion.div>
        )}
      </div>
    </motion.header>
  );
}

const CHIP_COLOR: Record<Tone, "default" | "accent" | "success" | "warning" | "danger"> = {
  neutral: "default",
  accent: "accent",
  success: "success",
  warning: "warning",
  danger: "danger",
};

const DOT: Record<Tone, string> = {
  neutral: "bg-muted/50",
  accent: "bg-navy",
  success: "bg-success",
  warning: "bg-[#d18b00]",
  danger: "bg-danger",
};

/** Chip statusu (HeroUI) z kropką w tonie – jak StatusDot na stronie. */
export function StatusChip({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <Chip size="sm" variant="soft" color={CHIP_COLOR[tone]} className="gap-1.5 whitespace-nowrap">
      <span aria-hidden className={`size-1.5 rounded-full ${DOT[tone]}`} />
      <Chip.Label>{label}</Chip.Label>
    </Chip>
  );
}

export const ArrowRight = ({ className = "size-4" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M3 8h10m0 0L9 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Icon = {
  plus: (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="size-4">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  ),
  columns: (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="size-4">
      <path d="M2.5 3.5h11v9h-11zM6.2 3.5v9M9.8 3.5v9" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  grid: (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="size-4">
      <path d="M2.5 2.5h4.5V7H2.5zM9 2.5h4.5V7H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  list: (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="size-4">
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  timeline: (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="size-4">
      <path d="M4 2.5v11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="4" cy="5" r="1.5" fill="currentColor" />
      <circle cx="4" cy="11" r="1.5" fill="currentColor" />
      <path d="M7.5 5h6M7.5 11h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  file: (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" className="size-7">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  external: (
    <svg aria-hidden viewBox="0 0 16 16" fill="none" className="size-4">
      <path d="M9 3h4v4M13 3 7.5 8.5M11 9.5V13H3V5h3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export function EmptyBlock({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="border-y border-border py-16 text-center">
      <p className="text-lg font-semibold text-ink">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-muted">{text}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}

export function ErrorBlock({ message }: { message: string }) {
  return (
    <div role="alert" className="my-4 border-l-2 border-danger bg-danger-soft px-4 py-3 text-sm">
      <p className="font-semibold text-danger-soft-foreground">Coś poszło nie tak</p>
      <p className="mt-0.5 text-danger-soft-foreground/90">{message}</p>
    </div>
  );
}

/** Etykieta sekcji: wersaliki w kolorze akcentu (jak „Generator formularzy”). */
export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-sm font-semibold tracking-wide text-accent uppercase">{children}</p>
);
