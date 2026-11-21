import { useRef, useState } from "react";
import { api } from "@/api";
import { visiblePages, type Values } from "@/lib/conditions";
import { errorMessage } from "@/lib/format";
import { validateField } from "@/lib/validators";
import type { Application, PublishedForm } from "@/types";

export type Phase = "consent" | "steps" | "summary" | "sent";

/** Stan kreatora wniosku: krok, wartości, walidacja strony, zgoda na prefill i zapis. */
export function useWizard(form: PublishedForm, app: Application | null) {
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

  return {
    phase,
    values,
    prefilled,
    step,
    errors,
    sent,
    busy,
    actionError,
    savedAt,
    headingRef,
    pages,
    page,
    set,
    acceptConsent,
    goTo,
    next,
    save,
    displayValue,
  };
}
