/**
 * Stałe ruchu widoków agenta E. Krzywe, czasy i klasa korzenia pochodzą z pluginu admin-ui (agent B);
 * tu tylko wartości specyficzne dla wejścia .rise z blur i liczników na pulpicie.
 */
import { duration as baseDuration, ease as baseEase, uiScope } from "@/payload/plugins/admin-ui/theme";

export { uiScope };

/** --ease-out z brand.css. */
export const ease = baseEase.out;

/** Czasy w sekundach: fast/base/slow z pluginu + wejście .rise i doliczanie liczników. */
export const duration = { ...baseDuration, rise: 0.52, count: 0.9 } as const;

/** Wejście jak .rise na stronie głównej: y 10px, blur 3px, kolejne elementy co 60 ms. */
export const rise = { y: 10, blur: 3, stagger: 0.06, duration: duration.rise, ease } as const;
