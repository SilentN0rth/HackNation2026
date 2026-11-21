"use client";

import { api } from "@/api";
import { ErrorBox, Loading } from "@/components/Feedback";
import { useAsync } from "@/lib/useAsync";
import type { Application, PublishedForm } from "@/types";
import { ConsentPhase } from "./fill/ConsentPhase";
import { StepForm } from "./fill/StepForm";
import { SubmittedPhase } from "./fill/SubmittedPhase";
import { SummaryCard } from "./fill/SummaryCard";
import { useWizard } from "./fill/useWizard";
import { WizardProgress } from "./fill/WizardProgress";

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
  const w = useWizard(form, app);
  const { phase, pages, page, step, headingRef } = w;

  if (phase === "consent")
    return (
      <ConsentPhase
        formTitle={form.schema.title}
        headingRef={headingRef}
        busy={w.busy}
        actionError={w.actionError}
        onAnswer={w.acceptConsent}
      />
    );

  if (phase === "sent" && w.sent) return <SubmittedPhase sent={w.sent} headingRef={headingRef} />;

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

      <WizardProgress pages={pages} step={step} phase={phase} currentNo={currentNo} totalSteps={totalSteps} />

      {w.actionError && <ErrorBox message={w.actionError} />}

      {phase === "steps" && page && (
        <StepForm
          page={page}
          values={w.values}
          errors={w.errors}
          prefilled={w.prefilled}
          step={step}
          busy={w.busy}
          savedAt={w.savedAt}
          onChange={w.set}
          onBack={() => w.goTo(step - 1)}
          onSaveDraft={() => w.save("draft")}
          onNext={w.next}
        />
      )}

      {phase === "summary" && (
        <SummaryCard
          pages={pages}
          busy={w.busy}
          displayValue={w.displayValue}
          onEdit={(i) => w.goTo(i)}
          onSend={() => w.save("sent")}
        />
      )}
    </section>
  );
}
