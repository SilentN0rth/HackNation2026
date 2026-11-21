"use client";

/** Ruch widoków kolekcji – krzywe i czasy z motywu panelu (plugin admin-ui). */
import { useReducedMotion, type Transition, type Variants } from "motion/react";
import { duration, ease, transition } from "@/payload/plugins/admin-ui/theme";

export { duration, ease, transition };

/** Odpowiednik .rise ze strony: 10 px w górę, blur 3 px, kolejne elementy co 60 ms. */
const riseItem: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(3px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.52, ease: ease.out } },
};
const riseList: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };

/** Warianty listy z uwzględnieniem prefers-reduced-motion. */
export function useRise() {
  const reduce = Boolean(useReducedMotion());
  const item: Variants = reduce ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } } : riseItem;
  const list: Variants = reduce ? { hidden: {}, show: {} } : riseList;
  const layout: Transition = reduce ? { duration: 0 } : { duration: duration.slow, ease: ease.out };
  return { item, list, layout, reduce };
}

/** Pasek wysuwany od dołu (akcje masowe, zapis). */
export function useSlideUp() {
  const reduce = useReducedMotion();
  return reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: duration.fast } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 16 }, transition: transition.enter };
}
