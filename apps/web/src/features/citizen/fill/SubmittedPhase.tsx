import Link from "next/link";
import type { RefObject } from "react";
import { Check, primaryLink } from "@/components/Feedback";
import type { Application } from "@/types";

export function SubmittedPhase({ sent, headingRef }: { sent: Application; headingRef: RefObject<HTMLHeadingElement | null> }) {
  return (
    <section className="max-w-2xl" role="status">
      <span aria-hidden className="rise grid size-12 place-items-center rounded-full bg-ink text-white">
        <Check className="size-5" />
      </span>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="rise mt-8 text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-ink outline-none sm:text-5xl"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        Wniosek został wysłany
      </h1>
      <dl className="rise mt-8 border-y border-border py-5" style={{ "--i": 2 } as React.CSSProperties}>
        <dt className="text-sm text-ink-3">Numer potwierdzenia (UPO)</dt>
        <dd className="mt-1 font-mono text-xl text-ink">{sent.confirmationNo}</dd>
      </dl>
      <p className="rise mt-5 text-ink-3" style={{ "--i": 3 } as React.CSSProperties}>
        Status wniosku sprawdzisz w zakładce „Twoje sprawy”.
      </p>
      <Link href="/citizen/applications" className={`rise mt-10 ${primaryLink}`} style={{ "--i": 4 } as React.CSSProperties}>
        Przejdź do Twoich spraw
      </Link>
    </section>
  );
}
