"use client";

/**
 * Stałe ruchu widoków kolekcji. Nazwy zgodne z "@/payload/plugins/admin-ui/theme" (agent B) –
 * po scaleniu importy można przełączyć na plugin.
 */
import { useReducedMotion, type Transition, type Variants } from "motion/react";

/** Krzywa --ease-out ze styles.css. */
export const ease = [0.23, 1, 0.32, 1] as const;
export const duration = { fast: 0.15, base: 0.28, rise: 0.52 } as const;
export const transition: Transition = { duration: duration.base, ease };

/** Odpowiednik klasy .rise: 10 px w górę, blur 3 px, odstęp 60 ms. */
export const rise = {
  item: {
    hidden: { opacity: 0, y: 10, filter: "blur(3px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: duration.rise, ease } },
  } satisfies Variants,
  list: { hidden: {}, show: { transition: { staggerChildren: 0.06 } } } satisfies Variants,
};

/** rise z uwzględnieniem prefers-reduced-motion. */
export function useRise() {
  const reduce = Boolean(useReducedMotion());
  const item: Variants = reduce ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } } : rise.item;
  const list: Variants = reduce ? { hidden: {}, show: {} } : rise.list;
  const layout: Transition = reduce ? { duration: 0 } : { duration: 0.32, ease };
  return { item, list, layout, reduce };
}

/** Pasek wysuwany od dołu (akcje masowe, zapis). */
export function useSlideUp() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: duration.fast } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 16 }, transition };
}
