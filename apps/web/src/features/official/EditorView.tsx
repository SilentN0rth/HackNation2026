"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button, Card, Tabs } from "@heroui/react";
import { api } from "@/api";
import { Breadcrumbs, DraftStatusBadge, ErrorBox, Loading } from "@/components/Feedback";
import { FieldRenderer } from "@/components/FieldRenderer";
import { canPublish, isHandled } from "@/lib/lint";
import { errorMessage } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import type { Field, FormDraft, LintFlag, StatuteChunk } from "@/types";
import { CoiJsonPanel } from "./editor/CoiJsonPanel";
import { FieldEditor } from "./editor/FieldEditor";
import { LintPanel } from "./editor/LintPanel";
import { StructureNav } from "./editor/StructureNav";

type Tab = "field" | "preview" | "json";

interface Loaded {
  draft: FormDraft;
  flags: LintFlag[];
  chunks: StatuteChunk[];
}

export function EditorView({ draftId }: { draftId: string }) {
  const router = useRouter();
  const { data, setData, error, loading } = useAsync<Loaded>(async () => {
    const [draft, flags, chunks] = await Promise.all([
      api.getDraft(draftId),
      api.runLinters(draftId),
      api.getStatuteChunks(draftId),
    ]);
    return { draft, flags, chunks };
  }, [draftId]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("preview");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const allFields = useMemo(() => data?.draft.schema.pages.flatMap((p) => p.fields) ?? [], [data]);
  const selected = allFields.find((f) => f.id === selectedId) ?? null;

  if (loading && !data) return <Loading text="Wczytujemy formularz i sprawdzamy jego jakość…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const { draft, flags, chunks } = data;
  if (draft.status === "processing") return <Loading text="Ten formularz jest jeszcze przetwarzany." />;

  const publishable = canPublish(flags);
  const flagsFor = (fieldId: string) => flags.filter((f) => f.fieldId === fieldId && !isHandled(f));

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
    } catch (e) {
      setActionError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const selectField = (id: string) => {
    setSelectedId(id);
    setTab("field");
  };

  const patchField = (fieldId: string, patch: Partial<Field> | null) => {
    const schema = structuredClone(draft.schema);
    for (const page of schema.pages) {
      const i = page.fields.findIndex((f) => f.id === fieldId);
      if (i === -1) continue;
      if (patch === null) page.fields.splice(i, 1);
      else page.fields[i] = { ...page.fields[i], ...patch };
    }
    setData({ ...data, draft: { ...draft, schema } });
    setDirty(true);
    if (patch === null) setSelectedId(null);
  };

  const saveAndLint = () =>
    guard(async () => {
      const saved = await api.updateDraftSchema(draft.id, draft.schema);
      const newFlags = await api.runLinters(draft.id);
      setData({ ...data, draft: saved, flags: newFlags });
      setDirty(false);
    });

  const resolve = (flagId: string, action: "fixed" | "rejected", justification?: string) =>
    guard(async () => {
      const updated = await api.resolveFlag(draft.id, flagId, { action, justification });
      setData({ ...data, flags: flags.map((f) => (f.id === flagId ? updated : f)) });
    });

  const publish = () =>
    guard(async () => {
      if (dirty) await api.updateDraftSchema(draft.id, draft.schema);
      await api.publishDraft(draft.id);
      router.push("/official");
    });

  return (
    <section>
      <header className="rise mb-10">
        <Breadcrumbs
          items={[
            { label: "Strona główna", to: "/" },
            { label: "Formularze", to: "/official" },
            { label: draft.schema.title },
          ]}
        />
        <div className="flex flex-wrap items-end gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-[2rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance text-ink sm:text-[2.5rem]">
              {draft.schema.title}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1">
              <DraftStatusBadge status={draft.status} />
              <span className="font-mono text-xs text-ink-3">{draft.schema.sourceFile}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" isDisabled={!dirty || busy} onPress={saveAndLint}>
              {dirty ? "Zapisz i sprawdź" : "Zapisano"}
            </Button>
            <Button
              variant="primary"
              isDisabled={!publishable || busy || draft.status === "published"}
              aria-describedby="publish-hint"
              onPress={publish}
            >
              Zatwierdź i opublikuj
            </Button>
          </div>
        </div>
      </header>
      {actionError && <ErrorBox message={actionError} />}

      <div className="rise grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)_340px]" style={{ "--i": 1 } as React.CSSProperties}>
        <StructureNav pages={draft.schema.pages} selectedId={selectedId} flagsFor={flagsFor} onSelect={selectField} />
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

            <Tabs.Panel id="field" className="pt-4">
              {selected ? (
                <FieldEditor
                  key={selected.id}
                  field={selected}
                  allFields={allFields}
                  chunks={chunks}
                  onPatch={(patch) => patchField(selected.id, patch)}
                />
              ) : (
                <p className="py-16 text-center text-ink-3">
                  Wybierz pole z listy po lewej albo kliknij „Pokaż pole” przy uwadze.
                </p>
              )}
            </Tabs.Panel>

            <Tabs.Panel id="preview" className="pt-4">
              {draft.schema.pages.map((p) => (
                <div key={p.id} className="mb-6">
                  <h2 className="mb-4 text-lg font-semibold">{p.title}</h2>
                  {p.fields.map((f) => (
                    <FieldRenderer key={f.id} field={f} value={undefined} onChange={() => undefined} readOnly />
                  ))}
                </div>
              ))}
            </Tabs.Panel>

            <Tabs.Panel id="json" className="flex flex-col gap-3 pt-4">
              <CoiJsonPanel draftId={draft.id} fileName={draft.schema.id} updatedAt={draft.updatedAt} />
            </Tabs.Panel>
          </Tabs>
        </Card>
        <LintPanel flags={flags} busy={busy} onSelectField={selectField} onResolve={resolve} />
      </div>
    </section>
  );
}
