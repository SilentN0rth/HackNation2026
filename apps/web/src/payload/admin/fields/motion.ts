/**
 * Stałe animacji pól. Tymczasowo lokalnie – po scaleniu z pluginem agenta B importy przejdą na
 * "@/payload/plugins/admin-ui/theme" (te same nazwy: ease, duration, transition).
 */
export const ease = [0.23, 1, 0.32, 1] as const;

export const duration = { fast: 0.18, base: 0.24, slow: 0.32 } as const;

export const transition = { duration: duration.base, ease } as const;
