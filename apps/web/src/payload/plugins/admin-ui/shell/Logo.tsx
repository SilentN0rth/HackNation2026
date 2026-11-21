import Link from "next/link";

/** Sygnet „e” – ten sam co w nagłówku strony publicznej. Domyślnie 18 px: tyle miejsca daje okruszek Payloada (graphics.Icon). */
export function Icon({ size = 18 }: { size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.round(size * 0.54) }}
      className="grid shrink-0 place-items-center rounded-[5px] bg-accent font-bold text-white"
    >
      e
    </span>
  );
}

/** Logo na ekranach Payloada (graphics.Logo) – bez linku, Payload sam decyduje o otoczeniu. */
export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <Icon size={28} />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Formularze</span>
    </span>
  );
}

/** Logo z linkiem jak na stronie publicznej. Nazwa dostępna = widoczny tekst (WCAG 2.5.3), cel linku w atrybucie title. */
export function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="press flex items-center gap-2.5 rounded-md" title="Strona główna">
      <Icon size={28} />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">
        <span className="sr-only">e-</span>Formularze
      </span>
    </Link>
  );
}
