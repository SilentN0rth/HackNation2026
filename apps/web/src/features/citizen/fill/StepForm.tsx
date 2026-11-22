import { Alert, Button, Card } from "@heroui/react";
import { api } from "@/api";
import { FieldRenderer } from "@/components/FieldRenderer";
import { isLocked, type Values } from "@/lib/conditions";
import type { FormPage } from "@/types";

interface Props {
  page: FormPage;
  values: Values;
  errors: Record<string, string>;
  prefilled: Set<string>;
  step: number;
  busy: boolean;
  savedAt: string | null;
  onChange: (fieldId: string, value: string | boolean) => void;
  onBack: () => void;
  onSaveDraft: () => void;
  onNext: () => void;
}

export function StepForm({ page, values, errors, prefilled, step, busy, savedAt, onChange, onBack, onSaveDraft, onNext }: Props) {
  return (
    <Card>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onNext();
        }}
      >
        <Card.Content className="pt-2">
          {page.description && <p className="mb-4 text-muted">{page.description}</p>}
          {Object.values(errors).some(Boolean) && (
            <Alert status="danger" className="mb-6">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Popraw zaznaczone pola, żeby przejść dalej.</Alert.Title>
              </Alert.Content>
            </Alert>
          )}
          {page.fields.map((f) => (
            <FieldRenderer
              key={f.id}
              field={f}
              value={values[f.id]}
              error={errors[f.id] || null}
              prefilled={prefilled.has(f.id)}
              readOnly={Boolean(f.prefill) || isLocked(f, values)}
              onChange={(v) => onChange(f.id, v)}
              onUpload={api.uploadAttachment ? (file) => api.uploadAttachment!(file) : undefined}
            />
          ))}
        </Card.Content>
        <Card.Footer className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" isDisabled={step === 0} onPress={onBack}>
            Wstecz
          </Button>
          <Button variant="secondary" isDisabled={busy} onPress={onSaveDraft}>
            Zapisz szkic
          </Button>
          {savedAt && (
            <span className="text-sm text-muted" role="status">
              Zapisano o {savedAt}
            </span>
          )}
          <Button type="submit" variant="primary" className="ml-auto">
            Dalej
          </Button>
        </Card.Footer>
      </form>
    </Card>
  );
}
