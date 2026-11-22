import Link from "next/link";

export function Icon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 32 32" style={{ width: size, height: size }} className="shrink-0 text-accent" role="img" aria-hidden focusable="false">
      <rect width="32" height="32" rx="8" fill="currentColor" />
      <path d="M11.8 7.6h5.4l4.2 4.2v10.6a2 2 0 0 1-2 2h-7.6a2 2 0 0 1-2-2V9.6a2 2 0 0 1 2-2Z" fill="#fff" />
      <rect x="12.9" y="14.1" width="6.2" height="1.9" rx="0.95" fill="currentColor" />
      <rect x="12.9" y="17.4" width="4.2" height="1.9" rx="0.95" fill="currentColor" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <Icon size={28} />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">e-Formularze</span>
    </span>
  );
}

export function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="press flex items-center gap-2.5 rounded-md" title="Strona główna">
      <Icon size={28} />
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">e-Formularze</span>
    </Link>
  );
}
