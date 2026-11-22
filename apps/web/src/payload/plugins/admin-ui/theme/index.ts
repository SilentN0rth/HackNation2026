export const uiScope = "ef-ui";

export const ease = {
  out: [0.23, 1, 0.32, 1] as const,
  inOut: [0.77, 0, 0.175, 1] as const,
};

export const duration = { fast: 0.16, base: 0.22, slow: 0.3 } as const;

export const transition = {
  enter: { duration: duration.base, ease: ease.out },
  exit: { duration: duration.fast, ease: ease.out },
} as const;

export const rise = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: transition.enter,
} as const;

export const primaryLink =
  "press inline-flex h-11 items-center gap-2 rounded-md bg-accent px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-accent-hover";
export const secondaryLink =
  "press inline-flex h-11 items-center gap-2 rounded-md bg-default px-5 text-[15px] font-semibold text-ink transition-colors duration-150 hover:bg-default-hover";

export const heading = {
  h1: "text-4xl font-semibold tracking-[-0.02em] text-ink sm:text-5xl",
  h2: "text-2xl font-semibold tracking-[-0.02em] text-ink sm:text-3xl",
  label: "text-sm font-semibold uppercase text-accent",
} as const;

export { Providers, usePanelSettings, type PanelSettings } from "./Providers";
