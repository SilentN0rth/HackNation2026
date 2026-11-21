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
        className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
          drag
            ? "border-accent bg-accent-soft"
            : error
              ? "border-danger bg-danger-soft/40"
              : "border-border bg-surface hover:border-accent hover:bg-accent-soft/40"
        }`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-10 text-accent" fill="none" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
        </svg>
        <span className="text-lg font-medium">Przeciągnij plik formularza albo kliknij, aby wybrać</span>
        <span id={hintId} className="text-sm text-muted">
          PDF, DOC, DOCX, ODS, XLSX lub skan (JPG, PNG) · do {MAX_FILE_MB} MB
        </span>
      </button>
      <input
        ref={input}
        type="file"
        hidden
        tabIndex={-1}
        accept={ACCEPTED_EXTENSIONS.join(",")}
        onChange={(e) => accept(e.target.files?.[0])}
      />
      {error && (
        <p id={errId} className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
