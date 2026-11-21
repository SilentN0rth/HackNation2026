"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { FieldRenderer } from "@/components/FieldRenderer";
import { visiblePages, type Values } from "@/lib/conditions";
import type { FormSchema } from "@/types";
import { ease } from "../motion";

/** Podgląd obywatela na żywo: te same kontrolki co /citizen, warunki widoczności działają przy wypełnianiu. */
export function Preview({ schema }: { schema: FormSchema }) {
  const [values, setValues] = useState<Values>({});
  const pages = visiblePages(schema, values);
  return (
    <div data-testid="citizen-preview" className="flex flex-col gap-8">
      <p className="m-0 text-sm text-ink-3">Tak formularz zobaczy mieszkaniec. Możesz go wypełnić – nic nie zostanie zapisane.</p>
      {pages.map((p) => (
        <section key={p.id} className="border-t border-ink pt-5">
          <h3 className="m-0 mb-5 text-lg font-semibold text-ink">{p.title}</h3>
          <div className="flex flex-col gap-5">
            <AnimatePresence initial={false}>
              {p.fields.map((f) => (
                <motion.div
                  key={f.id}
                  layout="position"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease }}
                >
                  <FieldRenderer field={f} value={values[f.id]} onChange={(v) => setValues((prev) => ({ ...prev, [f.id]: v }))} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      ))}
    </div>
  );
}
