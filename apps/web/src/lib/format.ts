export const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
