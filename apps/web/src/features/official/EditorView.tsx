"use client";


import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Fieldset,
  Input,
  Label,
  ListBox,
  Select,
  Tabs,
  TextArea,
  TextField,
} from "@heroui/react";
import { api } from "@/api";
import { Breadcrumbs, DraftStatusBadge, ErrorBox, Loading, OpenFlagCounts } from "@/components/Feedback";
import { FieldRenderer } from "@/components/FieldRenderer";
import { FlagCard } from "@/components/FlagCard";
import { canPublish, countOpen, isHandled, sortFlags } from "@/lib/lint";
import { errorMessage } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { FIELD_TYPES, type Field, type FieldType, type FormDraft, type LintFlag, type StatuteChunk } from "@/types";

type Tab = "field" | "preview" | "json";

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Tekst",
  textarea: "Tekst długi",
  number: "Liczba",
  date: "Data",
  select: "Lista rozwijana",
  radio: "Jednokrotny wybór",
  checkbox: "Pole wyboru",
  pesel: "PESEL",
  postalCode: "Kod pocztowy",
  phone: "Telefon",
  email: "E-mail",
};

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

  const [coi, setCoi] = useState<unknown>(null);
  const updatedAt = data?.draft.updatedAt;
  useEffect(() => {
    if (tab !== "json") return;
    let live = true;
    api.getCoiJson(draftId).then(
      (value) => live && setCoi(value),
      (e: unknown) => live && setActionError(errorMessage(e)),
    );
    return () => {
      live = false;
    };
  }, [tab, draftId, updatedAt]);

  const allFields = useMemo(() => data?.draft.schema.pages.flatMap((p) => p.fields) ?? [], [data]);
  const selected = allFields.find((f) => f.id === selectedId) ?? null;

  if (loading && !data) return <Loading text="Wczytujemy formularz i sprawdzamy jego jakość…" />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;

  const { draft, flags, chunks } = data;
  if (draft.status === "processing") return <Loading text="Ten formularz jest jeszcze przetwarzany." />;

  const sorted = sortFlags(flags);
  const open = countOpen(flags);
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

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(coi, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${draft.schema.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
        <Card className="h-fit lg:sticky lg:top-20">
          <Card.Header>
            <Card.Title className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Struktura</Card.Title>
          </Card.Header>
          <Card.Content>
            <nav aria-label="Struktura formularza" className="flex flex-col gap-4">
              {draft.schema.pages.map((page) => (
                <div key={page.id}>
                  <h3 className="mb-1.5 text-xs font-semibold tracking-wide text-ink-3 uppercase">{page.title}</h3>
                  <ul className="flex flex-col">
                    {page.fields.map((f) => {
                      const fl = flagsFor(f.id);
                      const sev = fl.some((x) => x.severity === "error")
                        ? "error"
                        : fl.some((x) => x.severity === "warning")
                          ? "warning"
                          : null;
                      const isSel = selectedId === f.id;
                      return (
                        <li key={f.id}>
                          <button
                            type="button"
                            aria-current={isSel ? "true" : undefined}
                            onClick={() => selectField(f.id)}
                            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                              isSel ? "bg-default font-medium text-ink shadow-[inset_2px_0_0_var(--accent)]" : "text-ink-2 hover:bg-default/60 hover:text-ink"
                            }`}
                          >
                            {sev && (
                              <span
                                className={`size-2 shrink-0 rounded-full ${sev === "error" ? "bg-danger" : "bg-warning"}`}
                                role="img"
                                aria-label={sev === "error" ? "błąd krytyczny" : "ostrzeżenie"}
                              />
                            )}
                            <span className="truncate">{f.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </Card.Content>
        </Card>
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
              <div>
                <Button size="sm" variant="secondary" isDisabled={!coi} onPress={downloadJson}>
                  Pobierz JSON
                </Button>
              </div>
              <pre className="max-h-[60vh] overflow-auto rounded-md bg-ink p-5 font-mono text-xs leading-relaxed text-white/85">
                {coi ? JSON.stringify(coi, null, 2) : "Wczytywanie…"}
              </pre>
            </Tabs.Panel>
          </Tabs>
        </Card>
        <aside aria-label="Panel lintera" className="flex flex-col gap-3">
          <Card>
            <Card.Header>
              <Card.Title className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Kontrola jakości</Card.Title>
            </Card.Header>
            <Card.Content className="flex flex-col gap-3">
              <OpenFlagCounts errors={open.errors} warnings={open.warnings} infos={open.infos} showZero />
              <p id="publish-hint" className="text-sm text-muted" aria-live="polite">
                {publishable
                  ? "Wszystkie krytyczne uwagi są obsłużone. Możesz opublikować formularz."
                  : "Opublikujesz formularz, gdy obsłużysz wszystkie krytyczne uwagi."}
              </p>
            </Card.Content>
          </Card>
          {sorted.map((flag) => (
            <FlagCard
              key={flag.id}
              flag={flag}
              busy={busy}
              onSelectField={selectField}
              onResolve={(action, justification) => resolve(flag.id, action, justification)}
            />
          ))}
        </aside>
      </div>
    </section>
  );
}

interface FieldEditorProps {
  field: Field;
  allFields: Field[];
  chunks: StatuteChunk[];
  onPatch: (patch: Partial<Field> | null) => void;
}

function FieldEditor({ field, allFields, chunks, onPatch }: FieldEditorProps) {
  const cond = field.visibleIf;
  const condTargetMissing = cond && !allFields.some((f) => f.id === cond.fieldId);
  const sourceChunk = field.legalBasis?.chunkId ? chunks.find((c) => c.id === field.legalBasis!.chunkId) : undefined;
  const lb = field.legalBasis;

  return (
    <div className="flex flex-col gap-5">
      <TextField value={field.label} onChange={(v) => onPatch({ label: v })} className="flex flex-col gap-1.5">
        <Label>Treść pytania</Label>
        <Input />
      </TextField>

      <TextField
        value={field.helpText ?? ""}
        onChange={(v) => onPatch({ helpText: v || undefined })}
        className="flex flex-col gap-1.5"
      >
        <Label>Podpowiedź pod pytaniem</Label>
        <Input />
      </TextField>

      <div className="flex flex-wrap items-end gap-6">
        <Select
          value={field.type}
          onChange={(k) => k && onPatch({ type: k as FieldType })}
          className="flex min-w-48 flex-col gap-1.5"
        >
          <Label>Typ pola</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              {FIELD_TYPES.map((t) => (
                <ListBox.Item key={t} id={t} textValue={FIELD_TYPE_LABELS[t]}>
                  {FIELD_TYPE_LABELS[t]}
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </Select.Popover>
        </Select>

        <Checkbox isSelected={field.required} onChange={(v) => onPatch({ required: v })} className="pb-2">
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Checkbox.Content>
            <Label>Obowiązkowe</Label>
          </Checkbox.Content>
        </Checkbox>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Select
          value={cond?.fieldId ?? "__always"}
          onChange={(k) =>
            onPatch({
              visibleIf: k && k !== "__always" ? { fieldId: String(k), equals: cond?.equals ?? "" } : undefined,
            })
          }
          isInvalid={condTargetMissing}
          className="flex min-w-60 flex-1 flex-col gap-1.5"
        >
          <Label>Pokaż pole tylko, gdy inne pole ma wartość</Label>
          <Select.Trigger>
            <Select.Value />
            <Select.Indicator />
          </Select.Trigger>
          <Select.Popover>
            <ListBox>
              <ListBox.Item id="__always" textValue="Zawsze widoczne">
                Zawsze widoczne
                <ListBox.ItemIndicator />
              </ListBox.Item>
              {condTargetMissing ? (
                <ListBox.Item id={cond.fieldId} textValue={`${cond.fieldId} (takie pole nie istnieje)`}>
                  {cond.fieldId} (takie pole nie istnieje)
                  <ListBox.ItemIndicator />
                </ListBox.Item>
              ) : null}
              {allFields
                .filter((f) => f.id !== field.id)
                .map((f) => (
                  <ListBox.Item key={f.id} id={f.id} textValue={f.id}>
                    <span className="font-mono text-sm">{f.id}</span>
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
            </ListBox>
          </Select.Popover>
        </Select>
        {cond && (
          <TextField
            value={String(cond.equals)}
            onChange={(v) => onPatch({ visibleIf: { ...cond, equals: v } })}
            className="flex w-36 flex-col gap-1.5"
          >
            <Label>Wymagana wartość</Label>
            <Input />
          </TextField>
        )}
      </div>

      <Fieldset className="rounded-xl border border-border p-4">
        <Fieldset.Legend className="px-1 font-semibold">Podstawa prawna</Fieldset.Legend>
        {lb ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted">{lb.act}</p>
            <TextField
              value={lb.unit}
              onChange={(v) => onPatch({ legalBasis: { ...lb, unit: v } })}
              className="flex flex-col gap-1.5"
            >
              <Label>Przepis (art., ust., pkt)</Label>
              <Input />
            </TextField>
            <TextField
              value={lb.quote}
              onChange={(v) => onPatch({ legalBasis: { ...lb, quote: v } })}
              className="flex flex-col gap-1.5"
            >
              <Label>Cytat z przepisu (dosłownie, bez zmian)</Label>
              <TextArea rows={3} />
            </TextField>
            {sourceChunk && (
              <div className="border-l-2 border-accent bg-default px-4 py-3 text-sm leading-relaxed">
                <strong>Brzmienie przepisu, {sourceChunk.unit}:</strong> {sourceChunk.text}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Brak. To pole nie ma oparcia w przepisie, rozważ jego usunięcie.</p>
        )}
      </Fieldset>

      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-muted">id: {field.id}</span>
        <Button size="sm" variant="danger-soft" className="ml-auto" onPress={() => onPatch(null)}>
          Usuń pole
        </Button>
      </div>
    </div>
  );
}
