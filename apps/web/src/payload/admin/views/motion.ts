import { duration as baseDuration, ease as baseEase, uiScope } from "@/payload/plugins/admin-ui/theme";

export { uiScope };

export const ease = baseEase.out;

export const duration = { ...baseDuration, rise: 0.52, count: 0.9 } as const;

export const rise = { y: 10, blur: 3, stagger: 0.06, duration: duration.rise, ease } as const;
