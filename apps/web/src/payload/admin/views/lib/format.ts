// Stała strefa urzędu: serwer (np. UTC na hostingu) i przeglądarka muszą wyrenderować ten sam tekst, inaczej hydratacja się rozjeżdża.
export const TIME_ZONE = "Europe/Warsaw";

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

export const formatTime = (iso: string) => new Date(iso).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });

export function dayKey(iso: string): string {
  // en-CA daje format RRRR-MM-DD
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: TIME_ZONE }).format(new Date(iso));
}

export function dayLabel(key: string, now = new Date()): string {
  const today = dayKey(now.toISOString());
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString());
  if (key === today) return "Dzisiaj";
  if (key === yesterday) return "Wczoraj";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pl-PL", { day: "numeric", month: "long", year: "numeric" });
}

export function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const tens = n % 100;
  const units = n % 10;
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many;
}
