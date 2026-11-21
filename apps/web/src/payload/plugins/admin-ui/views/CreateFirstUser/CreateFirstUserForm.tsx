"use client";

import { useAuth } from "@payloadcms/ui";
import type { UserWithToken } from "@payloadcms/ui";
import type { ClientUser } from "payload";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, SubmitButton, TextInput } from "../../shell/FormBits";
import { PayloadRestError, useUsersApi } from "../../lib/useUsersApi";

const MIN_PASSWORD = 12;

export function CreateFirstUserForm({ adminRoute }: { adminRoute: string }) {
  const { setUser } = useAuth();
  const { request } = useUsersApi();
  const router = useRouter();
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "", initials: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof values) => (v: string) => setValues((s) => ({ ...s, [key]: v }));

  function validate() {
    const e: Record<string, string> = {};
    if (!values.name.trim()) e.name = "Wpisz imię i nazwisko.";
    if (!/^\S+@\S+\.\S+$/.test(values.email)) e.email = "Wpisz adres e-mail, np. jan.kowalski@urzad.gov.pl.";
    if (values.password.length < MIN_PASSWORD) e.password = `Hasło musi mieć co najmniej ${MIN_PASSWORD} znaków.`;
    if (values.confirm !== values.password) e.confirm = "Hasła nie są takie same.";
    return e;
  }

  async function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const data = await request<UserWithToken<ClientUser>>("/first-register", {
        body: {
          name: values.name.trim(),
          email: values.email.trim(),
          password: values.password,
          initials: values.initials.trim() || undefined,
          role: "admin",
        },
      });
      setUser(data);
      router.replace(adminRoute);
      router.refresh();
    } catch (err) {
      if (err instanceof PayloadRestError) {
        setErrors(err.fields);
        setError(err.status === 403 ? "Pierwsze konto już istnieje. Zaloguj się." : err.message);
      } else setError("Nie udało się założyć konta.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-busy={busy}>
      <FormAlert message={error} />
      <TextInput name="name" label="Imię i nazwisko" autoComplete="name" required autoFocus value={values.name} onChange={set("name")} error={errors.name} />
      <TextInput name="email" type="email" label="Adres e-mail" autoComplete="username" required value={values.email} onChange={set("email")} error={errors.email} />
      <TextInput
        name="password"
        type="password"
        label="Hasło"
        hint={`Co najmniej ${MIN_PASSWORD} znaków.`}
        autoComplete="new-password"
        required
        value={values.password}
        onChange={set("password")}
        error={errors.password}
      />
      <TextInput name="confirm" type="password" label="Powtórz hasło" autoComplete="new-password" required value={values.confirm} onChange={set("confirm")} error={errors.confirm} />
      <TextInput
        name="initials"
        label="Inicjały"
        hint="Widoczne w dzienniku decyzji. Zostaw puste, a wyliczymy je z imienia i nazwiska."
        maxLength={3}
        value={values.initials}
        onChange={set("initials")}
        error={errors.initials}
      />
      <div>
        <SubmitButton busy={busy}>Załóż konto</SubmitButton>
      </div>
    </form>
  );
}
