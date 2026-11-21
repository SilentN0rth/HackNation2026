"use client";

import { Button, Card, Tabs } from "@heroui/react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { canPublish, isHandled } from "@/lib/lint";
import type { Field, FormSchema, LintFlag, StatuteChunk } from "@/types";
import { formatDateTime } from "../lib/format";
import { docOf, errorText, rest } from "../lib/rest";
import type { FormDoc } from "../lib/types";
import { ease } from "../motion";
import { auditUrl, formsListUrl, uploadUrl } from "../routes";
import { ArrowLink, FormStatusDot, Notice, PageHeader, StatusDot, ViewRoot } from "../ui/bits";
import { Rise, Stagger } from "../ui/motion";
import { CoiJsonPanel } from "./CoiJsonPanel";
import { FieldEditor } from "./FieldEditor";
import { LintPanel } from "./LintPanel";
import { Preview } from "./Preview";
import { StructureNav } from "./StructureNav";

type Tab = "field" | "preview" | "json";
type Busy = null | "save" | "lint" | "resolve" | "publish" | "generate";

type Raw = Partial<FormDoc> & { id: number; schema?: FormSchema | null; lintFlags?: LintFlag[] | null };

/** Aktualizacja stanu z odpowiedzi REST (kształt jak toFormDoc, bez relacji). */
function merge(prev: FormDoc, raw: Raw): FormDoc {
  return {
    ...prev,
    title: raw.title ?? prev.title,
    status: raw.status ?? prev.status,
    aiStatus: raw.aiStatus ?? prev.aiStatus,
    aiError: raw.aiError ?? null,
    fastapiDraftId: raw.fastapiDraftId ?? prev.fastapiDraftId,
    schema: raw.schema && Array.isArray(raw.schema.pages) ? raw.schema : prev.schema,
    lintFlags: Array.isArray(raw.lintFlags) ? raw.lintFlags : prev.lintFlags,
    version: raw.version ?? prev.version,
    updatedAt: raw.updatedAt ?? prev.updatedAt,
  };
}

const patch = async (id: number, data: Record<string, unknown>, draft = true) =>
  docOf<Raw>(await rest(`/forms/${id}`, { method: "PATCH", body: JSON.stringify(data) }, { draft, depth: 0 }));

export function EditorClient({ initial, chunks, userName }: { initial: FormDoc; chunks: StatuteChunk[]; userName: string }) {
  const [doc, setDoc] = useState(initial);
  const [schema, setSchema] = useState<FormSchema | null>(initial.schema);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const flags = doc.lintFlags;
  const allFields = useMemo(() => schema?.pages.flatMap((p) => p.fields) ?? [], [schema]);
  const selected = allFields.find((f) => f.id === selectedId) ?? null;
  const flagsFor = (fieldId: string) => flags.filter((f) => f.fieldId === fieldId && !isHandled(f));
  const publishable = canPublish(flags) && Boolean(schema?.pages.length);

  async function run(kind: Exclude<Busy, null>, fn: () => Promise<string | void>) {
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const message = await fn();
      if (message) setNotice(message);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const persistSchema = async () => {
    if (!schema) return;
    const saved = await patch(doc.id, { schema, title: schema.title });
    setDoc((d) => merge(d, saved));
    setDirty(false);
  };

  const save = () => run("save", async () => {
    await persistSchema();
    return "Zapisano wersję roboczą.";
  });

  const lint = () =>
    run("lint", async () => {
      if (dirty) await persistSchema();
      const body = docOf<Raw>(await rest(`/forms/${doc.id}/lint`, { method: "POST" }));
      setDoc((d) => merge(d, body));
      return "Kontrola jakości zakończona.";
    });

  const resolve = (flagId: string, action: "fixed" | "rejected", justification?: string) =>
    run("resolve", async () => {
      const at = new Date().toISOString();
      const next = flags.map((f) => (f.id === flagId ? { ...f, resolution: { action, justification, by: userName, at } } : f));
      const saved = await patch(doc.id, { lintFlags: next });
      setDoc((d) => merge(d, saved));
    });

  const publish = () =>
    run("publish", async () => {
      if (!schema) return;
      const saved = await patch(doc.id, { title: schema.title, schema, lintFlags: flags, status: "published", _status: "published" }, false);
      setDoc((d) => merge(d, saved));
      setSchema(saved.schema ?? schema);
      setDirty(false);
      return `Opublikowano wersję ${saved.version ?? ""}. Formularz jest dostępny dla obywateli.`;
    });

  const regenerate = () =>
    run("generate", async () => {
      const body = docOf<Raw>(await rest(`/forms/${doc.id}/generate`, { method: "POST" }));
      setDoc((d) => merge(d, body));
      if (body.schema) setSchema(body.schema);
      return "Silnik AI przygotował formularz.";
    });

  const selectField = (id: string) => {
    setSelectedId(id);
    setTab("field");
  };

  const patchField = (fieldId: string, p: Partial<Field> | null) => {
    if (!schema) return;
    const next = structuredClone(schema);
    for (const page of next.pages) {
      const i = page.fields.findIndex((f) => f.id === fieldId);
      if (i === -1) continue;
      if (p === null) page.fields.splice(i, 1);
      else page.fields[i] = { ...page.fields[i], ...p };
    }
    setSchema(next);
    setDirty(true);
    if (p === null) setSelectedId(null);
  };

  const addField = (pageId: string) => {
    if (!schema) return;
    const next = structuredClone(schema);
    const page = next.pages.find((p) => p.id === pageId);
    if (!page) return;
    let n = page.fields.length + 1;
    while (allFields.some((f) => f.id === `${pageId}_pole_${n}`)) n++;
    const field: Field = { id: `${pageId}_pole_${n}`, label: "Nowe pytanie", type: "text", required: false };
    page.fields.push(field);
    setSchema(next);
    setDirty(true);
    selectField(field.id);
  };

  const title = schema?.title ?? doc.title;

  return (
    <ViewRoot testId="panel-editor">
      <PageHeader
        crumbs={[{ label: "Pulpit", href: "/official" }, { label: "Formularze", href: formsListUrl() }, { label: title }]}
        eyebrow="Edytor formularza"
        title={title}
        description={
          <span className="flex flex-wrap items-center gap-x-5 gap-y-1 text-base">
            {doc.aiStatus === "error" ? <StatusDot label="Błąd silnika AI" tone="danger" /> : <FormStatusDot status={doc.status} />}
            {doc.sourceName && <span className="font-mono text-xs text-ink-3">{doc.sourceName}</span>}
            <span className="font-mono text-xs text-ink-3 tabular-nums">
              v{doc.version} · {formatDateTime(doc.updatedAt)}
            </span>
          </span>
        }
        actions={
          schema && (
            <>
              <Button variant="secondary" isDisabled={!dirty || busy !== null} isPending={busy === "save"} onPress={save}>
                {dirty ? "Zapisz" : "Zapisano"}
              </Button>
              <Button
                variant="primary"
                isDisabled={!publishable || busy !== null || (doc.status === "published" && !dirty)}
                isPending={busy === "publish"}
                aria-describedby="publish-hint"
                onPress={publish}
              >
                {doc.status === "published" && !dirty ? "Opublikowany" : "Zatwierdź i opublikuj"}
              </Button>
            </>
          )
        }
      />

      <AnimatePresence mode="popLayout">
        {(error || notice) && (
          <motion.div
            key={error ?? notice}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.3, ease }}
            className="mb-6"
            data-testid={error ? "editor-error" : "editor-notice"}
          >
            {error ? <Notice message={error} /> : <Notice status="success" title="Gotowe" message={notice} />}
          </motion.div>
        )}
      </AnimatePresence>

      {!schema ? (
        <Rise className="max-w-2xl">
          <Notice
            title={doc.aiStatus === "error" ? "Silnik AI nie przygotował formularza" : "Formularz nie ma jeszcze struktury"}
            message={doc.aiError ?? "Wgraj plik źródłowy albo ponów generowanie."}
          >
            <Button variant="primary" size="sm" isPending={busy === "generate"} onPress={regenerate}>
              Spróbuj ponownie
            </Button>
            <ArrowLink href={uploadUrl()}>Wgraj inny plik</ArrowLink>
          </Notice>
        </Rise>
      ) : (
        <Stagger className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)_330px]" delay={0.2}>
          <Rise>
            <StructureNav pages={schema.pages} selectedId={selectedId} flagsFor={flagsFor} onSelect={selectField} onAdd={addField} />
          </Rise>
          <Rise className="min-w-0">
            <Card className="min-w-0">
              <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as Tab)}>
                <Tabs.ListContainer>
                  <Tabs.List aria-label="Widok edytora">
                    <Tabs.Tab id="field">
                      Edycja pola
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="preview">
                      Widok obywatela
                      <Tabs.Indicator />
                    </Tabs.Tab>
                    <Tabs.Tab id="json">
                      JSON
                      <Tabs.Indicator />
                    </Tabs.Tab>
                  </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel id="field" className="pt-5">
                  <TabMotion id={`field-${selected?.id ?? "none"}`}>
                    {selected ? (
                      <FieldEditor field={selected} allFields={allFields} chunks={chunks} onPatch={(p) => patchField(selected.id, p)} />
                    ) : (
                      <p className="m-0 py-16 text-center text-ink-3">Wybierz pole z listy po lewej albo kliknij „Pokaż pole” przy uwadze.</p>
                    )}
                  </TabMotion>
                </Tabs.Panel>
                <Tabs.Panel id="preview" className="pt-5">
                  <TabMotion id="preview">
                    <Preview schema={schema} />
                  </TabMotion>
                </Tabs.Panel>
                <Tabs.Panel id="json" className="pt-5">
                  <TabMotion id="json">
                    <CoiJsonPanel formId={doc.id} fileName={schema.id} revision={doc.updatedAt} />
                  </TabMotion>
                </Tabs.Panel>
              </Tabs>
            </Card>
            <div className="mt-6">
              <ArrowLink href={auditUrl({ form: doc.id })} className="text-sm">
                Dziennik decyzji tego formularza
              </ArrowLink>
            </div>
          </Rise>
          <Rise>
            <LintPanel
              flags={flags}
              busy={busy !== null}
              linting={busy === "lint"}
              canLint={schema.pages.length > 0}
              onLint={lint}
              onSelectField={selectField}
              onResolve={resolve}
            />
          </Rise>
        </Stagger>
      )}
    </ViewRoot>
  );
}

/** Wejście zawartości zakładki (zmiana zakładki albo wybranego pola). */
function TabMotion({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <motion.div key={id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease }}>
      {children}
    </motion.div>
  );
}
