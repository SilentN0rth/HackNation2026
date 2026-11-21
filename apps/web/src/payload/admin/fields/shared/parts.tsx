"use client";

import { Description, Label } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "../fields.css";
import { useFieldMotion } from "./useFieldMotion";

/** Etykieta jak w formularzu obywatela: font-medium, „(nieobowiązkowe)” dla pól opcjonalnych. */
export function PanelLabel({ children, required, readOnly, htmlFor, elementType }: { children?: ReactNode; required?: boolean; readOnly?: boolean; htmlFor?: string; elementType?: string }) {
  if (!children) return null;
  return (
    <Label htmlFor={htmlFor} elementType={elementType} className="flex flex-wrap items-baseline gap-x-2 text-[0.9375rem] font-medium text-(--ink)">
      {children}
      {!required && !readOnly && <span className="text-sm font-normal text-(--ink-3)">(nieobowiązkowe)</span>}
      {readOnly && <span className="text-sm font-normal text-(--ink-3)">(tylko do odczytu)</span>}
    </Label>
  );
}

export function PanelDescription({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return <Description className="text-sm leading-relaxed text-(--ink-3)">{children}</Description>;
}

/** Błąd walidacji – wjeżdża wysokością i przezroczystością (motion), ogłaszany przez czytniki ekranu. */
export function PanelError({ message, id }: { message?: string; id?: string }) {
  const motionFor = useFieldMotion();
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key="error"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={motionFor("base")}
          className="overflow-hidden"
        >
          <p id={id} role="alert" data-testid="field-error" className="flex items-start gap-1.5 pt-1 text-sm font-medium text-(--danger)">
            <svg aria-hidden viewBox="0 0 16 16" className="mt-[3px] size-3.5 shrink-0" fill="currentColor">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v4.75h-1.5V4.5Zm.75 7.25a.9.9 0 1 1 0-1.8.9.9 0 0 1 0 1.8Z" />
            </svg>
            <span>{message}</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Kontener pola: klasa pf-field (tokeny + font), szerokość z admin.width, data-path dla testów. */
export function FieldShell({ path, type, children, style, className, invalid }: { path: string; type: string; children: ReactNode; style?: CSSProperties; className?: string; invalid?: boolean }) {
  return (
    <div
      className={["field-type pf-field ef-ui flex flex-col gap-1.5", className].filter(Boolean).join(" ")}
      data-pf-field={type}
      data-path={path}
      data-invalid={invalid || undefined}
      style={style}
    >
      {children}
    </div>
  );
}
