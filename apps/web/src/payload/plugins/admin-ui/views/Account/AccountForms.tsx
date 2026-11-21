"use client";

import { Checkbox, Description, Label, Radio, RadioGroup } from "@heroui/react";
import { toast, useAuth } from "@payloadcms/ui";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FormAlert, SubmitButton, TextInput } from "../../shell/FormBits";
import { PayloadRestError, useUsersApi } from "../../lib/useUsersApi";
import { heading, usePanelSettings, type PanelSettings } from "../../theme";

type User = { id: string | number; email: string; name: string; initials: string; role: string };

const MIN_PASSWORD = 12;

function Section({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <section className="mt-14 grid gap-8 border-t border-ink pt-8 lg:grid-cols-12">
      <div className="lg:col-span-4">
        <h2 className={heading.h2}>{title}</h2>
        <p className="mt-2 text-ink-3">{lead}</p>
      </div>
      <div className="lg:col-span-6 lg:col-start-6">{children}</div>
    </section>
  );
}

function Profile({ user }: { user: User }) {
  const { request } = useUsersApi();
  const { refreshCookie } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [initials, setInitials] = useState(user.initials);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: "Wpisz imię i nazwisko." });
    setBusy(true);
    setErrors({});
    try {
      await request(`/${user.id}`, { method: "PATCH", body: { name: name.trim(), initials: initials.trim() } });
      await refreshCookie();
      router.refresh();
      toast.success("Zapisano dane konta.");
    } catch (err) {
      if (err instanceof PayloadRestError) setErrors(err.fields);
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-busy={busy}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-[15px]">
        <dt className="text-ink-3">E-mail</dt>
        <dd className="font-medium">{user.email}</dd>
        <dt className="text-ink-3">Rola</dt>
        <dd className="font-medium">{user.role}</dd>
      </dl>
      <TextInput name="name" label="Imię i nazwisko" autoComplete="name" required value={name} onChange={setName} error={errors.name} />
      <TextInput
        name="initials"
        label="Inicjały"
        hint="Widoczne w dzienniku decyzji. Zostaw puste, a wyliczymy je z imienia i nazwiska."
        maxLength={3}
        value={initials}
        onChange={setInitials}
        error={errors.initials}
      />
      <div>
        <SubmitButton busy={busy}>Zapisz dane</SubmitButton>
      </div>
    </form>
  );
}

function Password({ user }: { user: User }) {
  const { request } = useUsersApi();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (password.length < MIN_PASSWORD) next.password = `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`;
    if (confirm !== password) next.confirm = "Hasła nie są takie same.";
    setErrors(next);
    setError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await request(`/${user.id}`, { method: "PATCH", body: { password } });
      setPassword("");
      setConfirm("");
      toast.success("Zmieniono hasło.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zmienić hasła.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-busy={busy}>
      <FormAlert message={error} />
      <TextInput
        name="new-password"
        type="password"
        label="Nowe hasło"
        hint={`Co najmniej ${MIN_PASSWORD} znaków.`}
        autoComplete="new-password"
        required
        value={password}
        onChange={setPassword}
        error={errors.password}
      />
      <TextInput name="confirm-password" type="password" label="Powtórz nowe hasło" autoComplete="new-password" required value={confirm} onChange={setConfirm} error={errors.confirm} />
      <div>
        <SubmitButton busy={busy}>Zmień hasło</SubmitButton>
      </div>
    </form>
  );
}

const DENSITY: { value: PanelSettings["density"]; label: string; hint: string }[] = [
  { value: "comfortable", label: "Wygodna", hint: "Więcej odstępów, łatwiej trafić w pola." },
  { value: "compact", label: "Zwarta", hint: "Więcej wierszy na ekranie listy." },
];

const START: { value: PanelSettings["defaultView"]; label: string }[] = [
  { value: "dashboard", label: "Pulpit" },
  { value: "forms", label: "Formularze" },
  { value: "audit-log", label: "Dziennik decyzji" },
];

function Preferences() {
  const { settings, save } = usePanelSettings();

  async function update(patch: Partial<PanelSettings>) {
    try {
      await save(patch);
      toast.success("Zapisano preferencje.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Nie udało się zapisać preferencji.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <RadioGroup value={settings.density} onChange={(v) => update({ density: v as PanelSettings["density"] })} className="flex flex-col gap-3">
        <Label className="font-medium">Gęstość widoku</Label>
        {DENSITY.map((o) => (
          <Radio key={o.value} value={o.value}>
            <Radio.Content>
              <Radio.Control>
                <Radio.Indicator />
              </Radio.Control>
              <Label className="text-[15px]">{o.label}</Label>
            </Radio.Content>
            <Description className="text-sm">{o.hint}</Description>
          </Radio>
        ))}
      </RadioGroup>
      <RadioGroup value={settings.defaultView} onChange={(v) => update({ defaultView: v as PanelSettings["defaultView"] })} className="flex flex-col gap-3">
        <Label className="font-medium">Widok po zalogowaniu</Label>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {START.map((o) => (
            <Radio key={o.value} value={o.value}>
              <Radio.Content>
                <Radio.Control>
                  <Radio.Indicator />
                </Radio.Control>
                <Label className="text-[15px]">{o.label}</Label>
              </Radio.Content>
            </Radio>
          ))}
        </div>
      </RadioGroup>
      <Checkbox isSelected={settings.animations} onChange={(v) => update({ animations: v })}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <Label className="text-[15px] font-medium">Animacje interfejsu</Label>
        </Checkbox.Content>
        <Description className="text-sm">Wyłącz, jeśli ruch na ekranie przeszkadza. Ustawienie systemu „ogranicz ruch” działa zawsze.</Description>
      </Checkbox>
    </div>
  );
}

export function AccountForms({ user }: { user: User }) {
  return (
    <>
      <Section title="Dane" lead="Imię, nazwisko i inicjały zapisujemy przy każdej decyzji w dzienniku.">
        <Profile user={user} />
      </Section>
      <Section title="Hasło" lead="Hasło do logowania w panelu urzędnika.">
        <Password user={user} />
      </Section>
      <Section title="Preferencje" lead="Ustawienia wspólne dla panelu tego urzędu.">
        <Preferences />
      </Section>
    </>
  );
}
