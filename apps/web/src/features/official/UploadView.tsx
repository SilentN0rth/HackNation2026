"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, UPLOAD_STEP_LABELS, type UploadStep } from "@/api";
import { Dropzone } from "@/components/Dropzone";
import { Check, ErrorBox, PageHeader } from "@/components/Feedback";
import { errorMessage } from "@/lib/format";

const STEPS: UploadStep[] = ["upload", "parse", "ocr", "generate", "lint"];

const HINTS: Record<UploadStep, string> = {
  upload: "Sprawdzamy rozszerzenie, typ MIME i nazwę pliku.",
  parse: "Odczytujemy tekst, tabele i układ stron.",
  ocr: "Dla skanów rozpoznajemy tekst lokalnym modelem.",
  generate: "Dzielimy formularz na strony tematyczne i pola.",
  lint: "Szukamy braków walidacji, słowników i podstawy prawnej.",
  done: "",
};

export function UploadView() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<UploadStep | null>(null);
  const [error, setError] = useState<string | null>(null);

  const start = async (f: File) => {
    setFile(f);
    setError(null);
    try {
      const { draftId } = await api.uploadDocument(f, setStep);
      router.push(`/official/drafts/${draftId}`);
    } catch (e) {
      setError(errorMessage(e));
      setStep(null);
    }
  };

  const current = step === "done" ? STEPS.length : step ? STEPS.indexOf(step) : -1;
  const running = step !== null;

  return (
    <section>
      <PageHeader
        crumbs={[{ label: "Formularze", to: "/official" }, { label: "Nowy z pliku" }]}
        title="Nowy formularz z pliku"
        description="Wgraj blankiet. System zaproponuje wersję elektroniczną, a kontrola jakości wskaże miejsca do sprawdzenia. O publikacji decydujesz Ty."
      />

      <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
        <div className="rise flex flex-col gap-4" style={{ "--i": 1 } as React.CSSProperties}>
          <Dropzone onFile={start} disabled={running} />
          {file && (
            <p className="fade-in flex items-center gap-3 text-sm text-ink-3">
              <span className="font-semibold text-ink">Plik</span>
              <span className="truncate font-mono">{file.name}</span>
              <span className="ml-auto tabular-nums">{(file.size / 1024).toFixed(0)} KB</span>
            </p>
          )}
          {error && <ErrorBox message={error} />}
        </div>

        <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
          <h2 className="border-b border-ink pb-3 text-xs font-semibold tracking-wide text-ink-3 uppercase">
            {running ? `Etap ${Math.min(current + 1, STEPS.length)} z ${STEPS.length}` : "Co się wydarzy"}
          </h2>
          <div className="relative h-px bg-border" aria-hidden>
            <div
              className="progress-line absolute inset-0 bg-accent"
              style={{ transform: `scaleX(${running ? Math.max(current, 0) / STEPS.length : 0})` }}
            />
          </div>
          <ol aria-live="polite" className="flex flex-col">
            {STEPS.map((s, i) => {
              const done = running && i < current;
              const active = running && i === current;
              return (
                <li key={s} className="flex gap-4 border-b border-border py-4">
                  <span
                    aria-hidden
                    className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-colors duration-200 ${
                      done
                        ? "bg-ink text-white"
                        : active
                          ? "bg-accent text-white"
                          : "border border-border text-ink-3"
                    }`}
                  >
                    {done ? <Check /> : i + 1}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className={`font-medium ${done || active ? "text-ink" : "text-ink-2"}`}>
                      {UPLOAD_STEP_LABELS[s]}
                      <span className="sr-only">{done ? " – zakończono" : active ? " – w toku" : " – oczekuje"}</span>
                    </span>
                    <span className="text-sm text-ink-3">{HINTS[s]}</span>
                  </span>
                  {active && <span aria-hidden className="pulse-dot mt-2 ml-auto size-1.5 shrink-0 rounded-full bg-accent" />}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
