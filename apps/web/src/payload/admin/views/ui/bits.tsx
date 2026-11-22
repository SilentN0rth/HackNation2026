"use client";

import { Alert, Link, RouterProvider } from "@heroui/react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { Severity } from "@/types";
import { SEVERITY_LABELS } from "@/types";
import { FORM_STATUS_LABELS, type FormStatus } from "../lib/types";
import { primaryLink } from "@/payload/plugins/admin-ui/theme";
import { uiScope } from "../motion";
import { Rise, Stagger } from "./motion";

export function PanelRouter({ children }: { children: ReactNode }) {
  const router = useRouter();
  return <RouterProvider navigate={(href) => router.push(href)}>{children}</RouterProvider>;
}

export function ViewRoot({ children, className = "", testId }: { children: ReactNode; className?: string; testId?: string }) {
  return (
    <PanelRouter>
      <div data-testid={testId} className={`${uiScope} ${className}`}>
        {children}
      </div>
    </PanelRouter>
  );
}

export const ArrowRight = ({ className = "size-4" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M3 8h10m0 0L9 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CheckIcon = ({ className = "size-3.5" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 16 16" fill="none" className={className}>
    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const UploadIcon = ({ className = "size-5" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 20 20" fill="none" className={className}>
    <path d="M10 13V3m0 0L6 7m4-4 4 4M3 13v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Eyebrow = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <p className={`m-0 text-sm font-semibold tracking-wide text-accent uppercase ${className}`}>{children}</p>
);

export function SectionTitle({ id, title, aside }: { id?: string; title: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h2 id={id} className="m-0 text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl">
        {title}
      </h2>
      {aside}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  crumbs,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  crumbs?: { label: string; href?: string }[];
}) {
  return (
    <Stagger as="header" className="mb-10 flex flex-col sm:mb-14">
      {crumbs && (
        <Rise as="div" className="mb-6">
          <nav aria-label="Ścieżka" className="text-sm text-ink-3">
            <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 gap-y-1 p-0">
              {crumbs.map((c, i) => (
                <li key={c.label} className="flex items-center gap-2">
                  {i > 0 && <span aria-hidden className="text-ink-3/50">/</span>}
                  {c.href ? (
                    <Link href={c.href} className="text-ink-3 no-underline transition-colors duration-150 hover:text-ink">
                      {c.label}
                    </Link>
                  ) : (
                    <span aria-current="page" className="text-ink-2">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </Rise>
      )}
      {eyebrow && (
        <Rise>
          <Eyebrow className="mb-4">{eyebrow}</Eyebrow>
        </Rise>
      )}
      <div className="flex flex-wrap items-end gap-6">
        <Rise className="min-w-0 flex-1">
          <h1 className="m-0 text-[2.25rem] leading-[1.06] font-semibold tracking-[-0.03em] text-balance text-ink sm:text-5xl">
            {title}
          </h1>
          {description && <div className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-ink-3">{description}</div>}
        </Rise>
        {actions && (
          <Rise className="flex flex-wrap items-center gap-3">
            {actions}
          </Rise>
        )}
      </div>
    </Stagger>
  );
}

export function RowLink({ href, title, text, meta, className = "" }: { href: string; title: ReactNode; text?: ReactNode; meta?: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`group flex w-full items-center gap-6 py-5 text-inherit no-underline ${className}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-semibold text-ink transition-colors duration-150 group-hover:text-accent">{title}</span>
        {text && <span className="mt-1 block text-ink-3">{text}</span>}
      </span>
      {meta}
      <ArrowRight className="size-5 shrink-0 text-accent transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-[3px]" />
    </Link>
  );
}

export function ArrowLink({ href, children, className = "" }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={`group inline-flex items-center gap-1.5 font-semibold text-accent no-underline ${className}`}>
      {children}
      <ArrowRight className="size-4 transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-[3px]" />
    </Link>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className={`${primaryLink} no-underline`}>
      {children}
    </Link>
  );
}

type Tone = "neutral" | "navy" | "success" | "warning" | "danger" | "accent";
const DOT: Record<Tone, string> = {
  neutral: "bg-ink-3/50",
  navy: "bg-[#08255f]",
  success: "bg-success",
  warning: "bg-[#d18b00]",
  danger: "bg-danger",
  accent: "bg-accent",
};

export const StatusDot = ({ label, tone, className = "" }: { label: ReactNode; tone: Tone; className?: string }) => (
  <span className={`inline-flex items-center gap-2 text-sm whitespace-nowrap text-ink-2 ${className}`}>
    <span aria-hidden className={`size-1.5 shrink-0 rounded-full ${DOT[tone]}`} />
    {label}
  </span>
);

const FORM_TONE: Record<FormStatus, Tone> = { draft: "neutral", in_review: "warning", published: "success" };
export const FormStatusDot = ({ status }: { status: FormStatus }) => <StatusDot label={FORM_STATUS_LABELS[status]} tone={FORM_TONE[status]} />;

const SEVERITY_TONE: Record<Severity, Tone> = { error: "danger", warning: "warning", info: "navy" };
export const SeverityDot = ({ severity }: { severity: Severity }) => <StatusDot label={SEVERITY_LABELS[severity]} tone={SEVERITY_TONE[severity]} />;

export function OpenFlags({ errors, warnings, infos, showZero = false }: { errors: number; warnings: number; infos?: number; showZero?: boolean }) {
  const items: [number, string, Severity][] = [
    [errors, "krytycznych", "error"],
    [warnings, "do sprawdzenia", "warning"],
    ...(infos !== undefined ? [[infos, "sugestii", "info"] as [number, string, Severity]] : []),
  ];
  const visible = showZero ? items : items.filter(([n]) => n > 0);
  if (visible.length === 0) return <span className="text-sm text-ink-3">Brak uwag</span>;
  return (
    <span className="flex flex-wrap gap-x-4 gap-y-1">
      {visible.map(([n, label, sev]) => (
        <StatusDot key={sev} label={`${n} ${label}`} tone={SEVERITY_TONE[sev]} />
      ))}
    </span>
  );
}

export function Notice({ title = "Coś poszło nie tak", message, status = "danger", children }: { title?: string; message: ReactNode; status?: "danger" | "warning" | "success" | "accent"; children?: ReactNode }) {
  return (
    <Alert status={status} role="alert" className="rounded-[10px]">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{title}</Alert.Title>
        <Alert.Description>{message}</Alert.Description>
        {children && <div className="mt-3 flex flex-wrap items-center gap-3">{children}</div>}
      </Alert.Content>
    </Alert>
  );
}
