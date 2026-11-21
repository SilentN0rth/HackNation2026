"use client";


import Link from "next/link";
import { useRef, useState } from "react";
import { Alert, Button, Card } from "@heroui/react";
import { api } from "@/api";
import { Check, ErrorBox, Loading, primaryLink } from "@/components/Feedback";
import { FieldRenderer } from "@/components/FieldRenderer";
import { visiblePages, type Values } from "@/lib/conditions";
import { errorMessage, useAsync } from "@/lib/useAsync";
import { validateField } from "@/lib/validators";
import type { Application, PublishedForm } from "@/types";

type Phase = "consent" | "steps" | "summary" | "sent";

export function FillFormView({ formId, applicationId }: { formId: string; applicationId?: string | null }) {
  const { data, error, loading } = useAsync(async () => {
    const form = await api.getPublishedForm(formId);
    const app = applicationId ? await api.getApplication(applicationId) : null;
    return { form, app };
  }, [formId, applicationId]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} />;
  if (!data) return null;
  return <Wizard key={formId + (applicationId ?? "")} form={data.form} app={data.app} />;
}

function Wizard({ form, app }: { form: PublishedForm; app: Application | null }) {
  const needsPrefill = form.schema.pages.some((p) => p.fields.some((f) => f.prefill));
  const [phase, setPhase] = useState<Phase>(app || !needsPrefill ? "steps" : "consent");
  const [values, setValues] = useState<Values>(() => {
    const defaults: Values = {};
    for (const p of form.schema.pages) for (const f of p.fields) if (f.defaultValue) defaults[f.id] = f.defaultValue;
    return { ...defaults, ...(app?.values ?? {}) };
  });
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [appId, setAppId] = useState<string | undefined>(app?.id);
  const [sent, setSent] = useState<Application | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const pages = visiblePages(form.schema, values);
  const page = pages[Math.min(step, pages.length - 1)];

  const focusHeading = () => requestAnimationFrame(() => headingRef.current?.focus());

  const set = (id: string, v: string | boolean) => {
    setValues((prev) => ({ ...prev, [id]: v }));
    setErrors((prev) => ({ ...prev, [id]: "" }));
    setPrefilled((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const run = async (fn: () => Promise<void>) => {
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

  const acceptConsent = (agree: boolean) =>
    run(async () => {
      if (agree) {
        const data = await api.getPrefill(form.id);
        const filled: Values = {};
        const ids = new Set<string>();
        for (const p of form.schema.pages)
          for (const f of p.fields)
            if (f.prefill && data[f.prefill.key]) {
              filled[f.id] = data[f.prefill.key];
              ids.add(f.id);
            }
        setValues((prev) => ({ ...filled, ...prev }));
        setPrefilled(ids);
      }
      setPhase("steps");
      focusHeading();
    });

  const validatePage = () => {
    const errs: Record<string, string> = {};
    for (const f of page.fields) {
      const msg = validateField(f, values[f.id]);
      if (msg) errs[f.id] = msg;
    }
    setErrors(errs);
    const first = Object.keys(errs)[0];
    if (first) requestAnimationFrame(() => document.querySelector<HTMLElement>(`[name="${first}"]`)?.focus());
    return !first;
  };

  const goTo = (nextStep: number, nextPhase: Phase = "steps") => {
    setStep(nextStep);
    setPhase(nextPhase);
    window.scrollTo?.(0, 0);
    focusHeading();
  };

  const next = () => {
    if (!validatePage()) return;
    if (step < pages.length - 1) goTo(step + 1);
    else goTo(step, "summary");
  };

  const save = (status: "draft" | "sent") =>
    run(async () => {
      const saved = await api.saveApplication({
        id: appId,
        formId: form.id,
        formTitle: form.schema.title,
        status,
        values,
      });
      setAppId(saved.id);
      if (status === "sent") {
        setSent(saved);
        setPhase("sent");
        focusHeading();
      } else {
        setSavedAt(new Date().toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" }));
      }
    });

  const displayValue = (fieldId: string) => {
    const v = values[fieldId];
    if (typeof v === "boolean") return v ? "Tak" : "Nie";
    if (!v) return "—";
    const f = pages.flatMap((p) => p.fields).find((x) => x.id === fieldId);
    return f?.options?.find((o) => o.value === v)?.label ?? v;
  };

  if (phase === "consent")
    return (
      <section className="max-w-2xl">
        <p className="rise text-sm font-semibold text-accent">{form.schema.title}</p>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="rise mt-3 text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance text-ink outline-none sm:text-5xl"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Czy możemy uzupełnić część danych za Ciebie?
        </h1>
        <div className="rise mt-6 flex flex-col gap-3" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="text-lg leading-relaxed text-ink-2">
            Pobierzemy z mObywatela imię, nazwisko, PESEL i adres. Przed wysłaniem wszystko sprawdzisz i w razie
            potrzeby poprawisz.
          </p>
          <p className="text-sm text-ink-3">To wersja demonstracyjna, dane są fikcyjne.</p>
          {actionError && <ErrorBox message={actionError} />}
        </div>
        <div className="rise mt-10 flex flex-wrap gap-3" style={{ "--i": 3 } as React.CSSProperties}>
          <Button size="lg" variant="primary" isPending={busy} onPress={() => acceptConsent(true)}>
            Tak, uzupełnij
          </Button>
          <Button size="lg" variant="secondary" isDisabled={busy} onPress={() => acceptConsent(false)}>
            Wpiszę dane samodzielnie
          </Button>
        </div>
      </section>
    );

  if (phase === "sent" && sent)
    return (
      <section className="max-w-2xl" role="status">
        <span aria-hidden className="rise grid size-12 place-items-center rounded-full bg-ink text-white">
          <Check className="size-5" />
        </span>
        <h1
          ref={headingRef}
          tabIndex={-1}
          className="rise mt-8 text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-ink outline-none sm:text-5xl"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          Wniosek został wysłany
        </h1>
        <dl className="rise mt-8 border-y border-border py-5" style={{ "--i": 2 } as React.CSSProperties}>
          <dt className="text-sm text-ink-3">Numer potwierdzenia (UPO)</dt>
          <dd className="mt-1 font-mono text-xl text-ink">{sent.confirmationNo}</dd>
        </dl>
        <p className="rise mt-5 text-ink-3" style={{ "--i": 3 } as React.CSSProperties}>
          Status wniosku sprawdzisz w zakładce „Twoje sprawy”.
        </p>
        <Link href="/citizen/applications" className={`rise mt-10 ${primaryLink}`} style={{ "--i": 4 } as React.CSSProperties}>
          Przejdź do Twoich spraw
        </Link>
      </section>
    );

  const totalSteps = pages.length + 1;
  const currentNo = phase === "summary" ? totalSteps : step + 1;

  return (
    <section className="max-w-3xl">
      <p className="rise text-sm font-semibold text-accent">{form.schema.title}</p>
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 mb-8 text-[2.25rem] leading-[1.1] font-semibold tracking-[-0.025em] text-ink outline-none sm:text-5xl">
        {phase === "summary" ? "Sprawdź dane przed wysłaniem" : page?.title}
        <span className="sr-only">
          {" "}
          – krok {currentNo} z {totalSteps}
        </span>
      </h1>

      <nav aria-label="Postęp wypełniania" className="mb-10">
        <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}>
          {[...pages.map((p) => p.title), "Podsumowanie"].map((title, i) => {
            const isSummary = i === pages.length;
            const done = isSummary ? false : phase === "summary" || i < step;
            const current = isSummary ? phase === "summary" : phase === "steps" && i === step;
            return (
              <li key={title + i} aria-current={current ? "step" : undefined} className="flex flex-col gap-2">
                <span
                  aria-hidden
                  className={`h-1 transition-colors duration-300 ${current ? "bg-accent" : done ? "bg-ink" : "bg-default"}`}
                />
                <span className={`hidden items-center gap-1.5 text-xs sm:flex ${current ? "font-semibold text-ink" : "text-ink-3"}`}>
                  {done ? <Check className="size-3 text-ink" /> : <span className="font-mono tabular-nums">{i + 1}</span>}
                  <span className="truncate">{title}</span>
                </span>
                {done && <span className="sr-only"> (ukończony)</span>}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-ink-3 sm:hidden">
          Krok {currentNo} z {totalSteps}
        </p>
      </nav>

      {actionError && <ErrorBox message={actionError} />}

      {phase === "steps" && page && (
        <Card>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              next();
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
                  onChange={(v) => set(f.id, v)}
                />
              ))}
            </Card.Content>
            <Card.Footer className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" isDisabled={step === 0} onPress={() => goTo(step - 1)}>
                Wstecz
              </Button>
              <Button variant="secondary" isDisabled={busy} onPress={() => save("draft")}>
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
      )}

      {phase === "summary" && (
        <Card>
          <Card.Content className="flex flex-col gap-6 pt-2">
            {pages.map((p, i) => (
              <div key={p.id}>
                <div className="mb-2 flex items-center gap-3 border-b border-border pb-2">
                  <h2 className="font-semibold">{p.title}</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    aria-label={`Zmień: ${p.title}`}
                    onPress={() => goTo(i)}
                  >
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
            <Button variant="ghost" onPress={() => goTo(pages.length - 1)}>
              Wstecz
            </Button>
            <Button variant="primary" className="ml-auto" isPending={busy} onPress={() => save("sent")}>
              Podpisz i wyślij
            </Button>
          </Card.Footer>
        </Card>
      )}
    </section>
  );
}
