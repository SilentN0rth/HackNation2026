"use client";

import { Button, Checkbox, Fieldset, Input, Label, ListBox, Select, TextArea, TextField } from "@heroui/react";
import { FIELD_TYPES, type Field, type FieldType, type StatuteChunk } from "@/types";

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
  file: "Załącznik",
};

interface FieldEditorProps {
  field: Field;
  allFields: Field[];
  chunks: StatuteChunk[];
  onPatch: (patch: Partial<Field> | null) => void;
}

export function FieldEditor({ field, allFields, chunks, onPatch }: FieldEditorProps) {
  const cond = field.visibleIf;
  const condTargetMissing = cond && !allFields.some((f) => f.id === cond.fieldId);
  const sourceChunk = field.legalBasis?.chunkId ? chunks.find((c) => c.id === field.legalBasis!.chunkId) : undefined;
  const lb = field.legalBasis;

  return (
    <div className="flex flex-col gap-5">
      <TextField value={field.label} onChange={(v) => onPatch({ label: v })} className="flex flex-col gap-1.5" data-testid="field-label">
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

      <Fieldset className="rounded-[10px] border border-border p-4">
        <Fieldset.Legend className="px-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Podstawa prawna</Fieldset.Legend>
        {lb ? (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-ink-3">{lb.act}</p>
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
                <strong className="text-ink">Brzmienie przepisu, {sourceChunk.unit}:</strong> {sourceChunk.text}
              </div>
            )}
          </div>
        ) : (
          <p className="m-0 text-sm text-ink-3">Brak. To pole nie ma oparcia w przepisie, rozważ jego usunięcie.</p>
        )}
      </Fieldset>

      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-ink-3">id: {field.id}</span>
        <Button size="sm" variant="danger-soft" className="ml-auto" onPress={() => onPatch(null)}>
          Usuń pole
        </Button>
      </div>
    </div>
  );
}
