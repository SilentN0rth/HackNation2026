"use client";

import { Button, Link } from "@heroui/react";
import { useField } from "@payloadcms/ui";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { Thumb } from "./Cells";
import { duration, ease } from "./motion";
import { Icon, SectionLabel } from "./ui";

const EXT: Record<string, string> = {
  "application/pdf": "PDF",
  "application/msword": "DOC",
  "application/x-cfb": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.oasis.opendocument.spreadsheet": "ODS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "image/jpeg": "JPG",
  "image/png": "PNG",
};
const ext = (mime?: string, name?: string) => (mime && EXT[mime]) || name?.split(".").pop()?.toUpperCase() || "PLIK";
const size = (n?: number) => (!n ? "" : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`);

const validate = (value: unknown) => {
  if (!value && value !== undefined) return "Wybierz plik.";
  if (value && !(value as File).name) return "Plik musi mieć nazwę.";
  return true;
};

export function UploadPanel({ isCreate, data }: { isCreate: boolean; data?: Record<string, unknown> }) {
  const { value, setValue, errorMessage, showError } = useField<File | null>({ path: "file", validate: isCreate ? validate : undefined });
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [replace, setReplace] = useState(false);
  const file = value instanceof File ? value : null;
  const saved = !isCreate && data?.filename ? data : null;
  const preview = file && file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;

  const pick = (f?: File | null) => f && setValue(f);

  return (
    <section className="flex flex-col gap-4" data-testid="upload-panel">
      <SectionLabel>Plik</SectionLabel>
      {saved && !replace && (
        <div className="flex flex-wrap items-center gap-5 border-y border-border py-5">
          <Thumb
            src={String(saved.mimeType ?? "").startsWith("image/") ? String(saved.thumbnailURL || saved.url) : undefined}
            ext={ext(saved.mimeType as string, saved.filename as string)}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{String(saved.filename)}</p>
            <p className="mt-1 font-mono text-[13px] text-muted">
              {ext(saved.mimeType as string)} · {size(saved.filesize as number)}
            </p>
          </div>
          {Boolean(saved.url) && (
            <Link href={String(saved.url)} target="_blank" className="link-arrow inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
              Otwórz {Icon.external}
            </Link>
          )}
          <Button variant="secondary" size="sm" onPress={() => setReplace(true)}>
            Zamień plik
          </Button>
        </div>
      )}
      {(!saved || replace) && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            pick(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center gap-4 rounded-[10px] border border-dashed px-6 py-10 text-center transition-colors duration-150 ${over ? "border-accent bg-accent-soft" : showError ? "border-danger" : "border-(--field-border)"}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {file ? (
              <motion.div key="file" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: duration.base, ease: ease.out }} className="flex items-center gap-4 text-left">
                <Thumb src={preview} ext={ext(file.type, file.name)} />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink" data-testid="upload-filename">{file.name}</p>
                  <p className="font-mono text-[13px] text-muted">{size(file.size)}</p>
                </div>
              </motion.div>
            ) : (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-2 text-muted">
                {Icon.file}
                <p className="font-semibold text-ink">Przeciągnij plik tutaj</p>
                <p className="text-sm">PDF, DOC, DOCX, ODS, XLSX, JPG albo PNG</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex gap-3">
            <Button variant="secondary" onPress={() => input.current?.click()}>
              {file ? "Wybierz inny" : "Wybierz plik"}
            </Button>
            {replace && (
              <Button variant="ghost" onPress={() => { setReplace(false); setValue(null); }}>
                Anuluj
              </Button>
            )}
          </div>
          <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label="Plik" data-testid="upload-input" onChange={(e) => pick(e.target.files?.[0])} />
        </div>
      )}
      {showError && errorMessage && <p className="text-sm text-danger" role="alert">{errorMessage}</p>}
    </section>
  );
}
