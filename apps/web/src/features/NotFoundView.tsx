import Link from "next/link";
import { ArrowRight } from "@/components/Feedback";

export function NotFoundView() {
  return (
    <section className="rise max-w-xl py-16">
      <p className="font-mono text-sm text-accent">404</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-[-0.025em] text-ink">Nie ma takiej strony</h1>
      <p className="mt-4 text-lg text-ink-3">Sprawdź adres albo wróć na stronę główną.</p>
      <Link href="/" className="link-arrow mt-8">
        Strona główna
        <ArrowRight />
      </Link>
    </section>
  );
}
