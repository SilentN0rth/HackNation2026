"use client";

import { useReducedMotion } from "motion/react";
import { useCallback } from "react";
import { duration, ease, usePanelSettings } from "@/payload/plugins/admin-ui/theme";

/**
 * Przejście motion/react dla pól: czasy i krzywa z motywu panelu, wyłączone przy prefers-reduced-motion
 * albo gdy urzędnik wyłączył animacje w globalu „settings”.
 */
export function useFieldMotion() {
  const reduce = useReducedMotion();
  const { settings } = usePanelSettings();
  const off = Boolean(reduce) || !settings.animations;
  return useCallback((speed: keyof typeof duration = "base") => ({ duration: off ? 0 : duration[speed], ease: ease.out }), [off]);
}
