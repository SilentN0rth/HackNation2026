"use client";

/** Ruch widoków panelu (motion.dev): wejście jak .rise ze strony głównej, liczniki, wspólne krzywe. */
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type HTMLMotionProps, type Variants } from "motion/react";
import { useEffect } from "react";
import { duration, ease, rise } from "../motion";

/** --ease-out ze styles.css (alias dla motion.ts#ease). */
export const EASE_OUT = ease;

const RISE: Variants = {
  hidden: { opacity: 0, y: rise.y, filter: `blur(${rise.blur}px)` },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: rise.duration, ease: rise.ease } },
};
const FADE: Variants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2 } } };

/** Warianty pojedynczego elementu – przy prefers-reduced-motion tylko zanikanie. */
export function useRise(): Variants {
  return useReducedMotion() ? FADE : RISE;
}

const M = {
  div: motion.div,
  section: motion.section,
  header: motion.header,
  ul: motion.ul,
  ol: motion.ol,
  li: motion.li,
  dl: motion.dl,
  aside: motion.aside,
  p: motion.p,
} as const;

type Tag = keyof typeof M;
type Props = HTMLMotionProps<"div"> & { as?: Tag };

/** Kontener: dzieci <Rise> wchodzą jedno po drugim co 60 ms. */
export function Stagger({ as = "div", delay = 0, children, ...rest }: Props & { delay?: number }) {
  const Comp = M[as] as typeof motion.div;
  return (
    <Comp
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: rise.stagger, delayChildren: delay } } }}
      {...rest}
    >
      {children}
    </Comp>
  );
}

/** Element wchodzący jak .rise (y 10px, blur 3px). W <Stagger> dziedziczy kolejność. */
export function Rise({ as = "div", children, ...rest }: Props) {
  const variants = useRise();
  const Comp = M[as] as typeof motion.div;
  return (
    <Comp variants={variants} {...rest}>
      {children}
    </Comp>
  );
}

/** Licznik doliczający do wartości (tabular-nums). Czytniki ekranu dostają od razu wynik. */
export function Counter({ value, className, delay = 0.2 }: { value: number; className?: string; delay?: number }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString("pl-PL"));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration: duration.count, delay, ease });
    return () => controls.stop();
  }, [value, reduce, mv, delay]);
  return (
    <span className={className} data-value={value}>
      <motion.span aria-hidden>{text}</motion.span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
