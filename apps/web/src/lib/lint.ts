import type { LintFlag, Severity } from "../types";

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

export function sortFlags(flags: LintFlag[]): LintFlag[] {
  return [...flags].sort((a, b) => {
    const resolved = Number(Boolean(a.resolution)) - Number(Boolean(b.resolution));
    if (resolved !== 0) return resolved;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });
}

export function isHandled(flag: LintFlag): boolean {
  if (!flag.resolution) return false;
  if (flag.resolution.action === "rejected") return Boolean(flag.resolution.justification?.trim());
  return true;
}

export function canPublish(flags: LintFlag[]): boolean {
  return flags.filter((f) => f.severity === "error").every(isHandled);
}

export function countOpen(flags: LintFlag[]) {
  const open = flags.filter((f) => !isHandled(f));
  return {
    errors: open.filter((f) => f.severity === "error").length,
    warnings: open.filter((f) => f.severity === "warning").length,
    infos: open.filter((f) => f.severity === "info").length,
  };
}
