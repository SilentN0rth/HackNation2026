"use client";

import { Button, Link } from "@heroui/react";
import { toast } from "@payloadcms/ui";
import type { ShellData } from "./DocumentShell";
import { Icon, SectionLabel } from "./ui";

export function ApiView({ shell, doc }: { shell: ShellData; doc: Record<string, unknown> }) {
  const url = shell.kind === "collection" ? `${shell.apiRoute}/${shell.slug}/${shell.id}` : `${shell.apiRoute}/globals/${shell.slug}`;
  const json = JSON.stringify(doc, null, 2);
  return (
    <div data-testid="api-view">
      <div className="mb-6 flex flex-wrap items-center gap-4 border-t border-ink pt-5">
        <div className="min-w-0 flex-1">
          <SectionLabel>REST API</SectionLabel>
          <p className="mt-2 truncate font-mono text-sm text-ink-2">GET {url}</p>
        </div>
        <Button
          variant="secondary"
          onPress={() => {
            void navigator.clipboard?.writeText(json).then(() => toast.success("Skopiowano JSON."));
          }}
        >
          Kopiuj JSON
        </Button>
        <Link href={`${url}?depth=1`} target="_blank" className="link-arrow inline-flex items-center gap-1.5 font-semibold text-accent">
          Otwórz {Icon.external}
        </Link>
      </div>
      <pre className="max-h-[70vh] overflow-auto rounded-[10px] border border-border bg-surface-secondary p-5 font-mono text-[13px] leading-relaxed text-ink">{json}</pre>
    </div>
  );
}
