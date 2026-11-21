"use client";

import { Link } from "@heroui/react";
import type { CellValue, ColumnDef } from "./types";
import { StatusChip } from "./ui";

/** Miniatura pliku: obraz albo chip z rozszerzeniem (jak lista formatów na stronie głównej). */
export function Thumb({ src, ext, size = "sm" }: { src?: string; ext?: string; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "aspect-[4/3] w-full" : "size-9 shrink-0";
  if (src && !src.startsWith("mime:")) {
    // eslint-disable-next-line @next/next/no-img-element -- miniatury z API Payloada (cookie sesji), bez optymalizacji Next
    return <img src={src} alt="" loading="lazy" className={`${box} rounded-[6px] border border-border object-cover`} />;
  }
  const label = ext ?? src?.slice(5) ?? "";
  return (
    <span className={`${box} grid place-items-center rounded-[6px] border border-border bg-default font-mono text-[11px] font-medium text-ink-2`}>
      {label}
    </span>
  );
}

export function Cell({ col, value }: { col: ColumnDef; value: CellValue }) {
  if (!value || value.text === "") return <span className="text-muted/60">—</span>;
  switch (col.kind) {
    case "status":
      return <StatusChip label={value.text} tone={value.tone} />;
    case "relation":
    case "upload":
      return (
        <span className="inline-flex min-w-0 items-center gap-2.5">
          {value.thumb && <Thumb src={value.thumb} />}
          {value.href ? (
            <Link href={value.href} className="truncate text-ink underline-offset-4 hover:text-accent hover:underline">
              {value.text}
            </Link>
          ) : (
            <span className="truncate">{value.text}</span>
          )}
        </span>
      );
    case "mime":
      return <span className="rounded-[4px] bg-default px-2 py-0.5 font-mono text-xs font-medium text-ink-2">{value.text}</span>;
    default:
      return (
        <span className={`block max-w-[28ch] truncate ${value.mono ? "font-mono text-[13px] text-ink-2 tabular-nums" : "text-ink-2"}`} title={value.text}>
          {value.text}
        </span>
      );
  }
}
