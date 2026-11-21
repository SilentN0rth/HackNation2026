import Link from "next/link";
import type { ApplicationStatus, DraftStatus, Severity } from "@/types";
import { SEVERITY_LABELS } from "@/types";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger";

const DOT: Record<Tone, string> = {
  neutral: "bg-ink-3/50",
  accent: "bg-navy",
  success: "bg-success",
  warning: "bg-[#d18b00]",
  danger: "bg-danger",
};

export const ArrowRight = ({ className = "size-4" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 16 16" fill="none" className={className}>
    <path d="M3 8h10m0 0L9 4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Check = ({ className = "size-3.5" }: { className?: string }) => (
  <svg aria-hidden viewBox="0 0 16 16" fill="none" className={className}>
    <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const Loading = ({ text = "Wczytywanie…" }: { text?: string }) => (
  <div role="status" className="flex items-center gap-3 py-10 text-ink-3">
    <span aria-hidden className="pulse-dot size-2 rounded-full bg-accent" />
    <span>{text}</span>
  </div>
);

export const Skeleton = ({ rows = 4 }: { rows?: number }) => (
  <div role="status" aria-label="Wczytywanie" className="flex flex-col divide-y divide-border border-y border-border">
    {Array.from({ length: rows }, (_, i) => (
      <div key={i} className="flex items-center gap-6 py-5">
        <span className="h-4 w-2/5 animate-pulse rounded bg-default" />
        <span className="ml-auto h-4 w-24 animate-pulse rounded bg-default" />
      </div>
    ))}
  </div>
);

export const ErrorBox = ({ message }: { message: string }) => (
  <div role="alert" className="my-4 border-l-2 border-danger bg-danger-soft px-4 py-3 text-sm">
    <p className="font-semibold text-danger-soft-foreground">Coś poszło nie tak</p>
    <p className="mt-0.5 text-danger-soft-foreground/90">{message}</p>
  </div>
);

export const StatusDot = ({ label, tone }: { label: string; tone: Tone }) => (
  <span className="inline-flex items-center gap-2 text-sm whitespace-nowrap text-ink-2">
    <span aria-hidden className={`size-1.5 rounded-full ${DOT[tone]}`} />
    {label}
  </span>
);

const DRAFT: Record<DraftStatus, [string, Tone]> = {
  processing: ["W przetwarzaniu", "neutral"],
  review: ["Do zatwierdzenia", "warning"],
  published: ["Opublikowany", "success"],
};
const APP: Record<ApplicationStatus, [string, Tone]> = {
  draft: ["Szkic", "neutral"],
  sent: ["Wysłany", "accent"],
  accepted: ["Przyjęty", "success"],
};
const SEVERITY: Record<Severity, Tone> = { error: "danger", warning: "warning", info: "accent" };

export const DraftStatusBadge = ({ status }: { status: DraftStatus }) => (
  <StatusDot label={DRAFT[status][0]} tone={DRAFT[status][1]} />
);
export const AppStatusBadge = ({ status }: { status: ApplicationStatus }) => (
  <StatusDot label={APP[status][0]} tone={APP[status][1]} />
);
export const SeverityBadge = ({ severity }: { severity: Severity }) => (
  <StatusDot label={SEVERITY_LABELS[severity]} tone={SEVERITY[severity]} />
);

export function OpenFlagCounts({
  errors,
  warnings,
  infos,
  showZero = false,
}: {
  errors: number;
  warnings: number;
  infos?: number;
  showZero?: boolean;
}) {
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
        <StatusDot key={sev} label={`${n} ${label}`} tone={SEVERITY[sev]} />
      ))}
    </span>
  );
}

export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Ścieżka" className="mb-6 text-sm text-ink-3">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="text-ink-3/50">/</span>}
            {c.to ? (
              <Link href={c.to} className="transition-colors duration-150 hover:text-ink">
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
  );
}

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  crumbs?: Crumb[];
}) {
  return (
    <header className="rise mb-10 sm:mb-12">
      {crumbs && <Breadcrumbs items={[{ label: "Strona główna", to: "/" }, ...crumbs]} />}
      <div className="flex flex-wrap items-end gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance text-ink sm:text-5xl">
            {title}
          </h1>
          {description && (
            <div className="mt-4 max-w-2xl text-lg leading-relaxed text-pretty text-ink-3">{description}</div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </header>
  );
}

export const primaryLink =
  "press inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-accent-hover";
export const secondaryLink =
  "press inline-flex h-11 items-center gap-2 rounded-md border border-[#c9cacc] bg-white px-5 text-[15px] font-semibold text-ink transition-colors duration-150 hover:border-ink";
