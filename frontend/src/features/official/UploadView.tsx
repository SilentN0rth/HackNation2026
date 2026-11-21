"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, ProgressBar, Spinner } from "@heroui/react";
import { api, UPLOAD_STEP_LABELS, type UploadStep } from "@/api";
import { Dropzone } from "@/components/Dropzone";
import { ErrorBox, PageHeader } from "@/components/Feedback";
import { errorMessage } from "@/lib/useAsync";

const STEPS: UploadStep[] = ["upload", "parse", "ocr", "generate", "lint"];

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

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader
        title="Nowy formularz z pliku"
        description="Wgraj blankiet formularza. AI zaproponuje wersję elektroniczną z podstawą prawną każdego pola, a lintery sprawdzą jej jakość. Ty decydujesz o publikacji."
      />

      <Dropzone onFile={start} disabled={step !== null} />

      {file && step && (
        <Card>
          <Card.Header>
            <Card.Title className="font-mono text-base break-all">{file.name}</Card.Title>
          </Card.Header>
          <Card.Content className="flex flex-col gap-4">
            <ProgressBar
              aria-label="Postęp przetwarzania"
              value={Math.max(current, 0)}
              maxValue={STEPS.length}
              valueLabel={`Etap ${Math.min(current + 1, STEPS.length)} z ${STEPS.length}`}
            >
              <ProgressBar.Track>
                <ProgressBar.Fill />
              </ProgressBar.Track>
            </ProgressBar>
            <ol aria-live="polite" className="flex flex-col gap-2">
              {STEPS.map((s, i) => {
                const done = i < current;
                const active = i === current;
                return (
                  <li key={s} className={`flex items-center gap-3 ${!done && !active ? "text-muted" : ""}`}>
                    <span aria-hidden className="flex size-5 items-center justify-center">
                      {done ? <span className="text-success">✔</span> : active ? <Spinner size="sm" /> : "○"}
                    </span>
                    <span className={active ? "font-medium" : undefined}>
                      {UPLOAD_STEP_LABELS[s]}
                      <span className="sr-only">{done ? " – zakończono" : active ? " – w toku" : " – oczekuje"}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </Card.Content>
        </Card>
      )}
      {error && <ErrorBox message={error} />}
    </section>
  );
}
