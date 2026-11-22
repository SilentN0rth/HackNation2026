import { Check } from "@/components/Feedback";
import type { FormPage } from "@/types";
import type { Phase } from "./useWizard";

interface Props {
  pages: FormPage[];
  step: number;
  phase: Phase;
  currentNo: number;
  totalSteps: number;
}

export function WizardProgress({ pages, step, phase, currentNo, totalSteps }: Props) {
  return (
    <nav aria-label="Postęp wypełniania" className="mb-10">
      <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
        {[...pages.map((p) => p.title), "Podsumowanie"].map((title, i) => {
          const isSummary = i === pages.length;
          const done = isSummary ? false : phase === "summary" || i < step;
          const current = isSummary ? phase === "summary" : phase === "steps" && i === step;
          return (
            <li key={title + i} aria-current={current ? "step" : undefined} className="flex flex-col gap-2">
              <span
                aria-hidden
                className={`h-1 transition-colors duration-300 ${current ? "bg-accent" : done ? "bg-ink" : "bg-default"}`}
              />
              <span className={`hidden items-center gap-1.5 text-xs sm:flex ${current ? "font-semibold text-ink" : "text-ink-3"}`}>
                {done ? <Check className="size-3 text-ink" /> : <span className="font-mono tabular-nums">{i + 1}</span>}
                <span className="truncate">{title}</span>
              </span>
              {done && <span className="sr-only"> (ukończony)</span>}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-ink-3 sm:hidden">
        Krok {currentNo} z {totalSteps}
      </p>
    </nav>
  );
}
