"use client";

import { useId, useRef, useState } from "react";
import { ACCEPTED_EXTENSIONS, MAX_FILE_MB, validateUploadFile } from "@/lib/validators";

interface Props {
  onFile: (file: File) => void;
  disabled?: boolean;
}

export function Dropzone({ onFile, disabled }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const errId = useId();

  const accept = (file: File | undefined) => {
    if (!file || disabled) return;
    const err = validateUploadFile(file);
    setError(err);
    if (!err) onFile(file);
  };

  return (
    <div>
      <button
        type="button"
        disabled={disabled}
        aria-describedby={`${hintId}${error ? ` ${errId}` : ""}`}
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files[0]);
        }}
        data-drag={drag || undefined}
        className={`group flex w-full flex-col items-start gap-6 rounded-[10px] border border-dashed px-8 py-10 text-left transition-[border-color,background-color,transform] duration-200 ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-50 sm:py-14 ${
          drag
            ? "scale-[1.01] border-accent bg-accent-soft/60"
            : error
              ? "border-danger bg-danger-soft/40"
              : "border-[#c9cacc] bg-white hover:border-ink"
        }`}
      >
        <span
          aria-hidden
          className={`grid size-11 place-items-center rounded-full border transition-colors duration-200 ${
            drag ? "border-accent bg-accent text-white" : "border-border bg-default text-ink"
          }`}
        >
          <svg viewBox="0 0 20 20" fill="none" className="size-5">
            <path d="M10 13V3m0 0L6 7m4-4 4 4M3 13v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="flex flex-col gap-1.5">
          <span className="text-xl font-semibold tracking-[-0.01em] text-ink">
            {drag ? "Upuść, aby rozpocząć analizę" : "Przeciągnij plik formularza"}
          </span>
          <span className="text-ink-3">
            albo <span className="font-semibold text-accent underline decoration-accent/30 underline-offset-4">wybierz z dysku</span>
          </span>
        </span>
        <span id={hintId} className="font-mono text-xs text-ink-3">
          PDF · DOC · DOCX · ODS · XLSX · JPG · PNG — do {MAX_FILE_MB} MB
        </span>
      </button>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        aria-label="Wybierz plik formularza z dysku"
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <p id={errId} className="fade-in mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
