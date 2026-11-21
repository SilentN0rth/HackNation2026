import { describe, expect, it } from "vitest";
import type { LintFlag } from "@/types";
import { canPublish, countOpen, isHandled, sortFlags } from "./lint";

const flag = (id: string, severity: LintFlag["severity"], resolution?: LintFlag["resolution"]): LintFlag => ({
  id,
  linter: "wcag",
  severity,
  title: id,
  message: "",
  resolution,
});
const fixed = { action: "fixed" as const, by: "AN", at: "2026-01-01" };
const rejected = (justification?: string) => ({ action: "rejected" as const, justification, by: "AN", at: "2026-01-01" });

describe("isHandled", () => {
  it("flaga bez rozstrzygnięcia nie jest obsłużona", () => {
    expect(isHandled(flag("a", "error"))).toBe(false);
  });
  it("poprawiona jest obsłużona", () => {
    expect(isHandled(flag("a", "error", fixed))).toBe(true);
  });
  it("odrzucona wymaga niepustego uzasadnienia", () => {
    expect(isHandled(flag("a", "error", rejected("bo tak trzeba")))).toBe(true);
    expect(isHandled(flag("a", "error", rejected("   ")))).toBe(false);
    expect(isHandled(flag("a", "error", rejected()))).toBe(false);
  });
});

describe("canPublish", () => {
  it("blokuje przy nieobsłużonej krytycznej", () => {
    expect(canPublish([flag("a", "error"), flag("b", "warning", fixed)])).toBe(false);
  });
  it("pozwala, gdy krytyczne są obsłużone, nawet z otwartymi ostrzeżeniami", () => {
    expect(canPublish([flag("a", "error", fixed), flag("b", "warning"), flag("c", "info")])).toBe(true);
  });
  it("pusta lista pozwala na publikację", () => {
    expect(canPublish([])).toBe(true);
  });
});

describe("sortFlags", () => {
  it("nierozstrzygnięte najpierw, potem wg wagi; nie mutuje wejścia", () => {
    const input = [flag("info", "info"), flag("err-done", "error", fixed), flag("warn", "warning"), flag("err", "error")];
    const copy = [...input];
    expect(sortFlags(input).map((f) => f.id)).toEqual(["err", "warn", "info", "err-done"]);
    expect(input).toEqual(copy);
  });
});

describe("countOpen", () => {
  it("liczy tylko nieobsłużone, wg wagi", () => {
    const flags = [flag("a", "error"), flag("b", "error", fixed), flag("c", "warning"), flag("d", "info"), flag("e", "info")];
    expect(countOpen(flags)).toEqual({ errors: 1, warnings: 1, infos: 2 });
  });
});
