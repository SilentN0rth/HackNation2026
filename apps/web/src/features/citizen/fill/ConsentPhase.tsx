import type { RefObject } from "react";
import { Button } from "@heroui/react";
import { ErrorBox } from "@/components/Feedback";

interface Props {
  formTitle: string;
  headingRef: RefObject<HTMLHeadingElement | null>;
  busy: boolean;
  actionError: string | null;
  onAnswer: (agree: boolean) => void;
}

export function ConsentPhase({ formTitle, headingRef, busy, actionError, onAnswer }: Props) {
  return (
    <section className="max-w-2xl">
      <p className="rise text-sm font-semibold text-accent">{formTitle}</p>
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="rise mt-3 text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance text-ink outline-none sm:text-5xl"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        Czy możemy uzupełnić część danych za Ciebie?
      </h1>
      <div className="rise mt-6 flex flex-col gap-3" style={{ "--i": 2 } as React.CSSProperties}>
        <p className="text-lg leading-relaxed text-ink-2">
          Pobierzemy z mObywatela imię, nazwisko, PESEL i adres. Przed wysłaniem wszystko sprawdzisz i w razie
          potrzeby poprawisz.
        </p>
        <p className="text-sm text-ink-3">To wersja demonstracyjna, dane są fikcyjne.</p>
        {actionError && <ErrorBox message={actionError} />}
      </div>
      <div className="rise mt-10 flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
        <Button size="lg" variant="primary" isPending={busy} onPress={() => onAnswer(true)}>
          Tak, uzupełnij
        </Button>
        <Button size="lg" variant="secondary" isDisabled={busy} onPress={() => onAnswer(false)}>
          Wpiszę dane samodzielnie
        </Button>
      </div>
    </section>
  );
}
