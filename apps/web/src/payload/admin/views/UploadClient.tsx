"use client";

import { Button, Card, Spinner } from "@heroui/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { UPLOAD_STEP_LABELS, type UploadStep } from "@/api/types";
import { ACCEPTED_EXTENSIONS, MAX_FILE_MB, validateUploadFile } from "@/lib/validators";
import { docOf, errorText, rest, RestError } from "./lib/rest";
import type { AiStatus } from "./lib/types";
import { editorUrl, formsListUrl } from "./routes";
import { CheckIcon, Notice, PageHeader, UploadIcon, ViewRoot } from "./ui/bits";
import { EASE_OUT, Rise, Stagger } from "./ui/motion";

const STEPS: Exclude<UploadStep, "done">[] = ["upload", "parse", "ocr", "generate", "lint"];

const HINTS: Record<(typeof STEPS)[number], string> = {
  upload: "Sprawdzamy rozszerzenie, typ pliku i zapisujemy go w repozytorium.",
  parse: "Odczytujemy tekst, tabele i układ stron.",
  ocr: "Dla skanów rozpoznajemy tekst lokalnym modelem.",
  generate: "Dzielimy formularz na strony tematyczne i pola.",
  lint: "Szukamy braków walidacji, słowników i podstawy prawnej.",
};

type FormResult = { id: number; aiStatus?: AiStatus; aiError?: string | null; schema?: unknown };

type Phase =
  | { kind: "idle" }
  | { kind: "running"; step: number }
  | { kind: "done" }
  | { kind: "error"; message: string; formId: number | null };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function UploadClient() {
  return (
    <ViewRoot testId="panel-upload">
      <UploadInner />
    </ViewRoot>
  );
}

function UploadInner() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => stopTicker(), []);

  function stopTicker() {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  }

  function startTicker(from: number) {
    stopTicker();
    let step = from;
    setPhase({ kind: "running", step });
    ticker.current = setInterval(() => {
      step = Math.min(step + 1, STEPS.length - 1);
      setPhase({ kind: "running", step });
    }, 900);
  }

  async function settle(form: FormResult): Promise<FormResult> {
    let current = form;
    for (let i = 0; i < 80 && current.aiStatus !== "ready" && current.aiStatus !== "error"; i++) {
      await wait(1500);
      current = docOf<FormResult>(await rest(`/forms/${form.id}`, {}, { draft: true, depth: 0 }));
    }
    return current;
  }

  async function finish(form: FormResult) {
    stopTicker();
    if (form.aiStatus === "error") {
      setPhase({ kind: "error", formId: form.id, message: form.aiError ?? "Silnik AI jest niedostępny." });
      return;
    }
    setPhase({ kind: "done" });
    await wait(700);
    router.push(editorUrl(form.id));
  }

  async function start(f: File) {
    setFile(f);
    setPhase({ kind: "running", step: 0 });
    let formId: number | null = null;
    try {
      const body = new FormData();
      body.append("file", f);
      body.append("_payload", JSON.stringify({ alt: f.name }));
      const media = docOf<{ id: number }>(await rest("/media", { method: "POST", body }));
      startTicker(1);
      const created = docOf<FormResult>(
        await rest("/forms", { method: "POST", body: JSON.stringify({ source: media.id }) }, { draft: true, depth: 0 }),
      );
      formId = created.id;
      await finish(await settle(created));
    } catch (e) {
      stopTicker();
      setPhase({ kind: "error", formId, message: errorText(e) });
    }
  }

  async function retry(formId: number) {
    startTicker(1);
    try {
      const doc = docOf<FormResult>(await rest(`/forms/${formId}/generate`, { method: "POST" }));
      await finish({ ...doc, aiStatus: doc.aiStatus ?? "ready" });
    } catch (e) {
      stopTicker();
      const message = e instanceof RestError && e.status === 503 ? e.message : errorText(e);
      setPhase({ kind: "error", formId, message });
    }
  }

  const running = phase.kind === "running";
  const current = phase.kind === "running" ? phase.step : phase.kind === "done" ? STEPS.length : -1;

  return (
    <div>
      <PageHeader
        crumbs={[{ label: "Pulpit", href: "/official" }, { label: "Formularze", href: formsListUrl() }, { label: "Nowy z pliku" }]}
        eyebrow="Nowy formularz"
        title="Wgraj blankiet"
        description="System zaproponuje wersję elektroniczną, a kontrola jakości wskaże miejsca do sprawdzenia. O publikacji decydujesz Ty."
      />

      <Stagger className="grid gap-12 lg:grid-cols-[1.3fr_1fr]" delay={0.15}>
        <Rise className="flex flex-col gap-4">
          <DropArea onFile={start} disabled={running || phase.kind === "done"} />
          <AnimatePresence>
            {file && (
              <motion.p
                key={file.name}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                className="m-0 flex items-center gap-3 text-sm text-ink-3"
              >
                <span className="font-semibold text-ink">Plik</span>
                <span className="truncate font-mono">{file.name}</span>
                <span className="ml-auto font-mono tabular-nums">{(file.size / 1024).toFixed(0)} KB</span>
              </motion.p>
            )}
          </AnimatePresence>
          <AnimatePresence mode="wait">
            {phase.kind === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.3, ease: EASE_OUT }}
                data-testid="upload-error"
              >
                <Notice title={phase.formId ? "Silnik AI nie przygotował formularza" : "Nie udało się wgrać pliku"} message={phase.message}>
                  {phase.formId != null && (
                    <>
                      <Button variant="primary" size="sm" onPress={() => retry(phase.formId!)}>
                        Spróbuj ponownie
                      </Button>
                      <Button variant="secondary" size="sm" onPress={() => router.push(editorUrl(phase.formId!))}>
                        Otwórz formularz
                      </Button>
                    </>
                  )}
                </Notice>
              </motion.div>
            )}
          </AnimatePresence>
        </Rise>

        <Rise>
          <Pipeline current={current} running={running} done={phase.kind === "done"} failed={phase.kind === "error"} />
        </Rise>
      </Stagger>
    </div>
  );
}

function Pipeline({ current, running, done, failed }: { current: number; running: boolean; done: boolean; failed: boolean }) {
  const reduce = useReducedMotion();
  const progress = done ? 1 : running ? Math.max(current, 0) / STEPS.length : 0;
  return (
    <section aria-labelledby="pipeline-title">
      <h2 id="pipeline-title" className="m-0 border-b border-ink pb-3 text-xs font-semibold tracking-wide text-ink-3 uppercase">
        {done ? "Gotowe – otwieramy edytor" : running ? `Etap ${Math.min(current + 1, STEPS.length)} z ${STEPS.length}` : failed ? "Przetwarzanie przerwane" : "Co się wydarzy"}
      </h2>
      <div className="relative h-0.5 overflow-hidden bg-border" aria-hidden>
        <motion.div
          className="absolute inset-0 origin-left bg-accent"
          initial={false}
          animate={{ scaleX: progress }}
          transition={reduce ? { duration: 0 } : { duration: 0.5, ease: EASE_OUT }}
        />
      </div>
      <ol aria-live="polite" data-testid="pipeline" className="m-0 flex list-none flex-col p-0">
        {STEPS.map((s, i) => {
          const isDone = done || ((running || failed) && i < current);
          const active = running && i === current;
          return (
            <li key={s} data-state={isDone ? "done" : active ? "active" : "pending"} className="flex gap-4 border-b border-border py-4">
              <motion.span
                aria-hidden
                animate={{ scale: active && !reduce ? [1, 1.08, 1] : 1 }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] transition-colors duration-200 ${
                  isDone ? "bg-ink text-white" : active ? "bg-accent text-white" : "border border-border text-ink-3"
                }`}
              >
                {isDone ? <CheckIcon /> : i + 1}
              </motion.span>
              <span className="flex flex-col gap-0.5">
                <span className={`font-medium ${isDone || active ? "text-ink" : "text-ink-2"}`}>
                  {UPLOAD_STEP_LABELS[s]}
                  <span className="sr-only">{isDone ? " – zakończono" : active ? " – w toku" : " – oczekuje"}</span>
                </span>
                <span className="text-sm text-ink-3">{HINTS[s]}</span>
              </span>
              {active && <Spinner size="sm" color="accent" className="mt-1 ml-auto shrink-0" aria-label="W toku" />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function DropArea({ onFile, disabled }: { onFile: (f: File) => void; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const reduce = useReducedMotion();

  const accept = (file: File | undefined) => {
    if (!file || disabled) return;
    const err = validateUploadFile(file);
    setError(err);
    if (!err) onFile(file);
  };

  return (
    <div>
      <motion.div
        animate={{ scale: drag && !reduce ? 1.01 : 1 }}
        transition={{ duration: 0.2, ease: EASE_OUT }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files[0]);
        }}
      >
        <Card
          data-testid="dropzone"
          data-drag={drag || undefined}
          className={`flex flex-col items-start gap-6 border-dashed px-8 py-10 transition-colors duration-200 sm:py-14 ${
            disabled ? "opacity-60" : ""
          } ${drag ? "border-accent bg-[#fce6ee]/60" : error ? "border-danger bg-danger-soft/40" : "border-[#c9cacc] hover:border-ink"}`}
        >
          <span
            aria-hidden
            className={`grid size-11 place-items-center rounded-full border transition-colors duration-200 ${
              drag ? "border-accent bg-accent text-white" : "border-border bg-default text-ink"
            }`}
          >
            <UploadIcon />
          </span>
          <span className="flex flex-col gap-1.5">
            <span className="text-xl font-semibold tracking-[-0.01em] text-ink">{drag ? "Upuść, aby rozpocząć analizę" : "Przeciągnij plik formularza"}</span>
            <span className="text-ink-3">albo wybierz go z dysku</span>
          </span>
          <Button variant="primary" isDisabled={disabled} aria-describedby={hintId} onPress={() => input.current?.click()}>
            {disabled ? <Spinner size="sm" color="current" /> : null}
            Wybierz plik
          </Button>
          <span id={hintId} className="font-mono text-xs text-ink-3">
            PDF · DOC · DOCX · ODS · XLSX · JPG · PNG — do {MAX_FILE_MB} MB
          </span>
        </Card>
      </motion.div>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        data-testid="upload-input"
        aria-label="Wybierz plik formularza z dysku"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="m-0 mt-3 text-sm text-danger"
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
