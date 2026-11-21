import { Card } from "@heroui/react";
import type { FormPage, LintFlag } from "@/types";

interface Props {
  pages: FormPage[];
  selectedId: string | null;
  flagsFor: (fieldId: string) => LintFlag[];
  onSelect: (fieldId: string) => void;
}

/** Lista stron i pól formularza z kropką przy polach z otwartymi uwagami. */
export function StructureNav({ pages, selectedId, flagsFor, onSelect }: Props) {
  return (
    <Card className="h-fit lg:sticky lg:top-20">
      <Card.Header>
        <Card.Title className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Struktura</Card.Title>
      </Card.Header>
      <Card.Content>
        <nav aria-label="Struktura formularza" className="flex flex-col gap-4">
          {pages.map((page) => (
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
                        onClick={() => onSelect(f.id)}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:-outline-offset-2 ${
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
  );
}
