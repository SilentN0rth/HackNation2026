import { Button, Card } from "@heroui/react";
import type { FormPage } from "@/types";

interface Props {
  pages: FormPage[];
  busy: boolean;
  displayValue: (fieldId: string) => string;
  onEdit: (step: number) => void;
  onSend: () => void;
}

export function SummaryCard({ pages, busy, displayValue, onEdit, onSend }: Props) {
  return (
    <Card>
      <Card.Content className="flex flex-col gap-6 pt-2">
        <section aria-labelledby="summary-heading">
          <h2 id="summary-heading" className="text-xl font-semibold text-ink">
            Podsumowanie
          </h2>
          <p className="mt-2 text-muted">
            Po wysłaniu wniosku zobaczysz go na liście Twoich spraw. Urząd może skontaktować się z Tobą, jeśli będzie
            potrzebował dodatkowych informacji.
          </p>
        </section>
        <section aria-labelledby="preview-heading">
          <h2 id="preview-heading" className="text-xl font-semibold text-ink">
            Podgląd
          </h2>
          <p className="mt-2 text-muted">
            Zanim przejdziesz do wyboru sposobu podpisu, sprawdź dane na podglądzie. Jeśli zobaczysz błędy, wróć do
            edycji.
          </p>
        </section>
        {pages.map((p, i) => (
          <div key={p.id}>
            <div className="mb-2 flex items-center gap-3 border-b border-border pb-2">
              <h3 className="font-semibold">{p.title}</h3>
              <Button size="sm" variant="ghost" className="ml-auto" aria-label={`Zmień: ${p.title}`} onPress={() => onEdit(i)}>
                Zmień
              </Button>
            </div>
            <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              {p.fields.map((f) => (
                <div key={f.id} className="contents">
                  <dt className="text-sm text-muted">{f.label}</dt>
                  <dd className="font-medium break-words">{displayValue(f.id)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </Card.Content>
      <Card.Footer className="flex flex-wrap gap-2">
        <Button variant="ghost" onPress={() => onEdit(pages.length - 1)}>
          Wstecz
        </Button>
        <Button variant="primary" className="ml-auto" isPending={busy} onPress={onSend}>
          Podpisz i wyślij
        </Button>
      </Card.Footer>
    </Card>
  );
}
