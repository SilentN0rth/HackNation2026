"use client";

import { Button, Card } from "@heroui/react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import type { FormPage, LintFlag } from "@/types";
import { ease } from "../motion";

interface Props {
  pages: FormPage[];
  selectedId: string | null;
  flagsFor: (fieldId: string) => LintFlag[];
  onSelect: (fieldId: string) => void;
  onAdd: (pageId: string) => void;
}

export function StructureNav({ pages, selectedId, flagsFor, onSelect, onAdd }: Props) {
  const reduce = useReducedMotion();
  const layoutTransition = reduce ? { duration: 0 } : { duration: 0.3, ease };
  return (
    <Card className="h-fit lg:sticky lg:top-24">
      <Card.Header>
        <Card.Title className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Struktura</Card.Title>
      </Card.Header>
      <Card.Content>
        <nav aria-label="Struktura formularza" className="flex flex-col gap-5">
          <LayoutGroup>
            {pages.map((page) => (
              <div key={page.id}>
                <h3 className="m-0 mb-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">{page.title}</h3>
                <ul className="m-0 flex list-none flex-col p-0">
                  <AnimatePresence initial={false}>
                    {page.fields.map((f) => {
                      const fl = flagsFor(f.id);
                      const sev = fl.some((x) => x.severity === "error") ? "error" : fl.some((x) => x.severity === "warning") ? "warning" : null;
                      const isSel = selectedId === f.id;
                      return (
                        <motion.li
                          key={f.id}
                          layout="position"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={layoutTransition}
                          className="relative"
                        >
                          {isSel && (
                            <motion.span
                              layoutId="structure-selected"
                              transition={layoutTransition}
                              aria-hidden
                              className="absolute inset-0 rounded-md bg-default shadow-[inset_2px_0_0_var(--accent)]"
                            />
                          )}
                          <button
                            type="button"
                            aria-current={isSel ? "true" : undefined}
                            onClick={() => onSelect(f.id)}
                            className={`relative flex w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 py-1.5 text-left text-sm transition-colors ${
                              isSel ? "font-medium text-ink" : "text-ink-2 hover:text-ink"
                            }`}
                          >
                            {sev && (
                              <span
                                className={`size-2 shrink-0 rounded-full ${sev === "error" ? "bg-danger" : "bg-[#d18b00]"}`}
                                role="img"
                                aria-label={sev === "error" ? "błąd krytyczny" : "ostrzeżenie"}
                              />
                            )}
                            <span className="truncate">{f.label || "(bez treści)"}</span>
                          </button>
                        </motion.li>
                      );
                    })}
                  </AnimatePresence>
                </ul>
                <Button size="sm" variant="ghost" className="mt-1 text-ink-3" onPress={() => onAdd(page.id)}>
                  + Dodaj pole
                </Button>
              </div>
            ))}
          </LayoutGroup>
        </nav>
      </Card.Content>
    </Card>
  );
}
