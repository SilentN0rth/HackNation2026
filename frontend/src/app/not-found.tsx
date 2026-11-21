import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-xl py-12 text-center">
      <h1 className="text-2xl font-semibold">Nie ma takiej strony</h1>
      <p className="mt-2 text-muted">Sprawdź adres albo wróć na stronę główną.</p>
      <Link href="/" className="mt-6 inline-block font-medium text-accent underline underline-offset-4">
        Strona główna
      </Link>
    </section>
  );
}
