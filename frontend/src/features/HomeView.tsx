import { Link } from "react-router";
import { ArrowRight, primaryLink } from "@/components/Feedback";

const STEPS = [
  {
    no: "01",
    title: "Wgrywasz blankiet",
    text: "PDF, DOC, DOCX, ODS, XLSX albo skan JPG lub PNG. Plik jest przetwarzany tylko na czas analizy.",
  },
  {
    no: "02",
    title: "Model rozpoznaje pola",
    text: "Lokalny model wydziela strony tematyczne, typy pól, słowniki i zależności między odpowiedziami.",
  },
  {
    no: "03",
    title: "Sprawdzasz uwagi",
    text: "Kontrola jakości wskazuje braki: pole bez podstawy prawnej, zły warunek, brak walidacji PESEL.",
  },
  {
    no: "04",
    title: "Publikujesz e-usługę",
    text: "Pobierasz JSON zgodny z wymaganiami albo od razu udostępniasz formularz obywatelom.",
  },
];

const FORMATS = ["PDF", "DOC", "DOCX", "ODS", "XLSX", "JPG", "PNG"];

const LINKS = [
  { to: "/official", title: "Formularze w obiegu", text: "Wersje robocze i opublikowane e-usługi" },
  { to: "/official/upload", title: "Nowy formularz z pliku", text: "Wgraj blankiet i wygeneruj strukturę" },
  { to: "/official/audit", title: "Dziennik decyzji", text: "Kto, kiedy i na jakiej podstawie zatwierdził zmianę" },
  { to: "/citizen", title: "Podgląd dla obywatela", text: "Tak formularz zobaczy mieszkaniec" },
];

export function HomeView() {
  return (
    <div className="flex flex-col gap-24 sm:gap-32">
      <section className="grid gap-12 pt-4 lg:grid-cols-[1.25fr_1fr] lg:items-end">
        <div>
          <p className="rise mb-5 text-sm font-semibold tracking-wide text-accent uppercase">Generator formularzy</p>
          <h1
            className="rise text-[2.75rem] leading-[1.04] font-semibold tracking-[-0.035em] text-balance text-ink sm:text-6xl lg:text-[4.25rem]"
            style={{ "--i": 1 } as React.CSSProperties}
          >
            Z papierowego wniosku do e‑usługi w&nbsp;kilka minut.
          </h1>
          <p
            className="rise mt-7 max-w-xl text-lg leading-relaxed text-pretty text-ink-3 sm:text-xl"
            style={{ "--i": 2 } as React.CSSProperties}
          >
            Urzędnik wgrywa formularz w dowolnym formacie, a system przygotowuje gotową strukturę formularza
            elektronicznego. Każde pole ma typ, walidację i podstawę prawną.
          </p>
          <div className="rise mt-10 flex flex-wrap items-center gap-6" style={{ "--i": 3 } as React.CSSProperties}>
            <Link to="/official/upload" className={primaryLink}>
              Wgraj formularz
            </Link>
            <Link to="/official" className="link-arrow">
              Zobacz formularze
              <ArrowRight />
            </Link>
          </div>
        </div>

        <dl
          className="rise grid grid-cols-2 border-t border-ink lg:mb-2"
          style={{ "--i": 4 } as React.CSSProperties}
        >
          {[
            ["7", "formatów wejściowych"],
            ["0", "zewnętrznych API"],
            ["5", "reguł kontroli jakości"],
            ["JSON", "gotowy do importu"],
          ].map(([v, l], i) => (
            <div key={l} className={`py-6 ${i % 2 ? "pl-6" : "pr-6"} ${i > 1 ? "border-t border-border" : ""}`}>
              <dt className="sr-only">{l}</dt>
              <dd className="text-4xl font-semibold tracking-[-0.03em] text-ink tabular-nums">{v}</dd>
              <dd className="mt-1 text-sm text-ink-3">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="jak" className="flex flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="jak" className="text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">
            Jak to działa
          </h2>
          <p className="max-w-md text-ink-3">Cztery kroki, z czego trzy wykonuje system. Decyzja zostaje po stronie urzędnika.</p>
        </div>
        <ol className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.no} className="rise border-t border-ink pt-5" style={{ "--i": i } as React.CSSProperties}>
              <span className="font-mono text-sm text-accent">{s.no}</span>
              <h3 className="mt-3 text-lg font-semibold text-ink">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-3">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.02em] text-ink sm:text-4xl">Na start</h2>
          <p className="mt-4 max-w-sm leading-relaxed text-ink-3">
            Obsługiwane formaty plików. Typ pliku sprawdzamy po zawartości, nie tylko po rozszerzeniu.
          </p>
          <ul className="mt-6 flex flex-wrap gap-2">
            {FORMATS.map((f) => (
              <li key={f} className="rounded-[4px] bg-default px-2.5 py-1 font-mono text-xs font-medium text-ink-2">
                {f}
              </li>
            ))}
          </ul>
        </div>
        <ul className="divide-y divide-border border-y border-border">
          {LINKS.map((l) => (
            <li key={l.to}>
              <Link to={l.to} className="row-link flex items-center gap-6 py-6">
                <span className="min-w-0 flex-1">
                  <span className="row-title block text-lg font-semibold text-ink">{l.title}</span>
                  <span className="mt-1 block text-ink-3">{l.text}</span>
                </span>
                <ArrowRight className="row-arrow size-5 shrink-0 text-accent" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
