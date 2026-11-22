"use client";

import { Button, Link } from "@heroui/react";
import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import type { ShellData } from "./DocumentShell";
import { useRise } from "./motion";
import { ArrowRight, EmptyBlock, StatusChip } from "./ui";
import type { VersionList } from "./versions";

export function VersionsView({ shell, versions }: { shell: ShellData; versions: VersionList }) {
  const { item, list } = useRise();
  const router = useRouter();
  if (versions.rows.length === 0) return <EmptyBlock title="Brak wersji" text="Wersje pojawią się po pierwszym zapisie dokumentu." />;
  return (
    <div data-testid="versions-view">
      <p className="mb-4 text-sm text-muted">
        {versions.totalDocs} {versions.totalDocs === 1 ? "wersja" : "wersji"} · od najnowszej
      </p>
      <motion.ul variants={list} initial="hidden" animate="show" className="divide-y divide-border border-y border-border">
        {versions.rows.map((v, i) => (
          <motion.li key={v.id} variants={item}>
            <Link href={`${shell.base}/versions/${v.id}`} className="row-link flex items-center gap-6 py-5 no-underline" data-testid="version-row">
              <span className="w-10 shrink-0 font-mono text-sm text-accent tabular-nums">{String(versions.totalDocs - (versions.page - 1) * 20 - i).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1">
                <span className="row-title block font-semibold text-ink">
                  <span className="font-mono tabular-nums">{v.date}</span>
                </span>
                <span className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusChip label={v.status === "published" ? "Opublikowana" : "Wersja robocza"} tone={v.status === "published" ? "success" : "neutral"} />
                  {v.latest && <StatusChip label="Bieżąca" tone="accent" />}
                  {v.autosave && <StatusChip label="Autozapis" />}
                  {v.author && <span className="text-sm text-muted">{v.author}</span>}
                </span>
              </span>
              <ArrowRight className="row-arrow size-5 shrink-0 text-accent" />
            </Link>
          </motion.li>
        ))}
      </motion.ul>
      {versions.totalPages > 1 && (
        <div className="mt-6 flex items-center gap-3">
          <Button variant="secondary" size="sm" isDisabled={versions.page <= 1} onPress={() => router.push(`?page=${versions.page - 1}`)}>
            Nowsze
          </Button>
          <span className="text-sm text-muted">
            Strona {versions.page} z {versions.totalPages}
          </span>
          <Button variant="secondary" size="sm" isDisabled={versions.page >= versions.totalPages} onPress={() => router.push(`?page=${versions.page + 1}`)}>
            Starsze
          </Button>
        </div>
      )}
    </div>
  );
}
