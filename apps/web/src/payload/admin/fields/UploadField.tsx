"use client";

import { Button, ComboBox, Input, ListBox, ProgressBar } from "@heroui/react";
import { useConfig } from "@payloadcms/ui";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ClientField } from "payload";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { docTitle, usePayloadApi, type DocLike } from "./shared/api";
import { FieldShell, PanelDescription, PanelError, PanelLabel } from "./shared/parts";
import { fieldId, usePanelField, type PanelFieldProps } from "./shared/usePanelField";
import { duration, ease } from "./motion";

type UploadClientField = ClientField & { relationTo: string; hasMany?: boolean };
type MediaDoc = DocLike & { filename?: string; mimeType?: string; filesize?: number; url?: string; thumbnailURL?: string | null; alt?: string };

const formatSize = (bytes?: number) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
};

const extOf = (name?: string) => (name?.split(".").pop() ?? "").toUpperCase().slice(0, 4);

/** Wgrywa plik przez REST Payloada (ta sama walidacja mime i hooki co natywny upload), z postępem. */
function uploadFile(url: string, file: File, onProgress: (p: number) => void): Promise<MediaDoc> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const body = new FormData();
    body.append("file", file);
    body.append("_payload", JSON.stringify({ alt: file.name }));
    xhr.open("POST", url);
    xhr.withCredentials = true;
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText) as { doc?: MediaDoc; errors?: { message: string }[]; message?: string };
        if (xhr.status < 300 && json.doc) resolve(json.doc);
        else reject(new Error(json.errors?.[0]?.message ?? json.message ?? `HTTP ${xhr.status}`));
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error("Brak połączenia z serwerem."));
    xhr.send(body);
  });
}

/** Plik – strefa upuszczania, podgląd wybranego pliku i wybór z biblioteki (kolekcja upload). */
export function UploadField(props: PanelFieldProps) {
  const field = props.field as UploadClientField;
  const slug = field.relationTo;
  const f = usePanelField<number | string | MediaDoc | null>(props);
  const api = usePayloadApi();
  const { getEntityConfig } = useConfig();
  const reduce = useReducedMotion();
  const id = fieldId(f.path);
  const errorId = `${id}-error`;
  const inputRef = useRef<HTMLInputElement>(null);

  const mimeTypes = ((getEntityConfig({ collectionSlug: slug }) as { upload?: { mimeTypes?: string[] } } | undefined)?.upload?.mimeTypes ?? []).join(",");
  const currentId = f.value && typeof f.value === "object" ? f.value.id : f.value;

  const [loaded, setDoc] = useState<MediaDoc | null>(null);
  // Podgląd tylko dla bieżącej wartości – po usunięciu/zmianie stary dokument znika bez efektu.
  const doc = loaded && currentId != null && String(loaded.id) === String(currentId) ? loaded : null;
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string>();
  const [library, setLibrary] = useState(false);
  const [search, setSearch] = useState("");
  const [options, setOptions] = useState<MediaDoc[]>([]);

  useEffect(() => {
    if (currentId == null || currentId === "" || doc) return;
    const ctrl = new AbortController();
    fetch(`${api.base}/${slug}/${currentId}?depth=0`, { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<MediaDoc>) : null))
      .then((d) => d && setDoc(d))
      .catch(() => undefined);
    return () => ctrl.abort();
  }, [currentId, api.base, slug, doc]);

  useEffect(() => {
    if (!library) return;
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      api.find(slug, { search, limit: 12, signal: ctrl.signal }).then((d) => setOptions(d as MediaDoc[])).catch(() => undefined);
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [library, search, api, slug]);

  const handleFiles = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || f.readOnly) return;
    setUploadError(undefined);
    setProgress(0);
    try {
      const created = await uploadFile(`${api.base}/${slug}`, file, setProgress);
      setDoc(created);
      f.setValue(created.id);
      setLibrary(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Nie udało się wgrać pliku.");
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void handleFiles(e.dataTransfer.files);
  };

  const isImage = doc?.mimeType?.startsWith("image/");
  const preview = doc?.thumbnailURL || (isImage ? doc?.url : undefined);
  const title = api.titleField(slug);

  return (
    <FieldShell path={f.path} type="upload" style={f.style} className={f.className} invalid={f.invalid || Boolean(uploadError)}>
      <PanelLabel htmlFor={`${id}-input`} required={f.required} readOnly={f.readOnly}>{f.label}</PanelLabel>
      <PanelDescription>{f.description}</PanelDescription>

      <AnimatePresence mode="popLayout" initial={false}>
        {doc && currentId != null ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : duration.base, ease }}
            data-testid="upload-preview"
            className="flex max-w-xl items-center gap-4 rounded-[10px] border border-(--border) p-3"
          >
            <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-[6px] bg-(--surface-secondary)">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt={doc.alt ?? ""} className="size-full object-cover" />
              ) : (
                <span className="pf-mono text-xs font-semibold text-(--accent)">{extOf(doc.filename)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <a href={doc.url} target="_blank" rel="noreferrer" className="block truncate font-semibold text-(--ink) hover:text-(--accent)">
                {docTitle(doc, title)}
              </a>
              <p className="pf-mono text-xs text-(--ink-3)">
                {[doc.mimeType, formatSize(doc.filesize)].filter(Boolean).join(" · ")}
              </p>
            </div>
            {!f.readOnly && (
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onPress={() => inputRef.current?.click()}>
                  Zmień
                </Button>
                <Button size="sm" variant="ghost" onPress={() => f.setValue(null)} aria-label="Usuń plik">
                  Usuń
                </Button>
              </div>
            )}
          </motion.div>
        ) : !f.readOnly ? (
          <motion.div
            key="drop"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : duration.base, ease }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            data-testid="upload-dropzone"
            data-dragging={dragging || undefined}
            className={[
              "flex max-w-xl flex-col items-center gap-3 rounded-[10px] border border-dashed px-6 py-8 text-center transition-colors duration-150",
              dragging ? "border-(--accent) bg-(--accent-soft)" : f.invalid ? "border-(--danger)" : "border-(--field-border)",
            ].join(" ")}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-7 text-(--accent)" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <div>
              <p className="font-semibold text-(--ink)">Przeciągnij plik tutaj</p>
              <p className="text-sm text-(--ink-3)">PDF, DOC, DOCX, ODS, XLSX, JPG lub PNG</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="primary" onPress={() => inputRef.current?.click()} isDisabled={progress !== null}>
                Wybierz z dysku
              </Button>
              <Button size="sm" variant="secondary" onPress={() => setLibrary((v) => !v)} aria-expanded={library}>
                Wybierz z biblioteki
              </Button>
            </div>
            <AnimatePresence>
              {progress !== null && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full max-w-xs">
                  <ProgressBar aria-label="Wgrywanie pliku" value={progress} size="sm" color="accent">
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ) : (
          <p key="empty" className="text-sm text-(--ink-3)">
            Brak pliku
          </p>
        )}
      </AnimatePresence>

      <input
        ref={inputRef}
        id={`${id}-input`}
        type="file"
        accept={mimeTypes || undefined}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void handleFiles(e.target.files)}
        data-testid="upload-input"
      />

      <AnimatePresence initial={false}>
        {library && !f.readOnly && (
          <motion.div
            key="library"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduce ? 0 : duration.base, ease }}
            className="overflow-hidden"
          >
            <ComboBox
              aria-label="Biblioteka plików"
              items={options}
              inputValue={search}
              onInputChange={setSearch}
              onSelectionChange={(key) => {
                const picked = options.find((o) => String(o.id) === String(key));
                if (!picked) return;
                setDoc(picked);
                f.setValue(picked.id);
                setLibrary(false);
                setSearch("");
              }}
              menuTrigger="focus"
              allowsEmptyCollection
              className="max-w-xl pt-1"
            >
              <ComboBox.InputGroup>
                <Input placeholder="Szukaj w bibliotece…" autoFocus />
                <ComboBox.Trigger />
              </ComboBox.InputGroup>
              <ComboBox.Popover className="pf-popover">
                <ListBox renderEmptyState={() => <p className="px-3 py-2 text-sm text-(--ink-3)">Brak plików</p>}>
                  {(item: MediaDoc) => (
                    <ListBox.Item id={String(item.id)} textValue={docTitle(item, title)}>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">{docTitle(item, title)}</span>
                        <span className="pf-mono text-xs text-(--ink-3)">{[item.mimeType, formatSize(item.filesize)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </ListBox.Item>
                  )}
                </ListBox>
              </ComboBox.Popover>
            </ComboBox>
          </motion.div>
        )}
      </AnimatePresence>

      <PanelError id={errorId} message={uploadError ?? f.error} />
    </FieldShell>
  );
}
