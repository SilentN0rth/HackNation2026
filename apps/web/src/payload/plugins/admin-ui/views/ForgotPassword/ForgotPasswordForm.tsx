"use client";

import Link from "next/link";
import { useState } from "react";
import { FormAlert, SubmitButton, TextInput } from "../../shell/FormBits";
import { useUsersApi } from "../../lib/useUsersApi";

export function ForgotPasswordForm({ loginHref }: { loginHref: string }) {
  const { request } = useUsersApi();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Wpisz adres e-mail, np. jan.kowalski@urzad.gov.pl.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await request("/forgot-password", { body: { email } });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się wysłać wiadomości.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-busy={busy}>
      <FormAlert message={error} />
      {/* Ten sam komunikat niezależnie od tego, czy konto istnieje – nie zdradzamy listy kont. */}
      <FormAlert tone="success" message={sent ? "Jeśli konto o tym adresie istnieje, wysłaliśmy na nie link do zmiany hasła." : null} />
      <TextInput name="email" type="email" label="Adres e-mail" autoComplete="username" required autoFocus value={email} onChange={setEmail} />
      <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={loginHref} className="link-arrow text-sm">
          Wróć do logowania
        </Link>
        <SubmitButton busy={busy}>Wyślij link</SubmitButton>
      </div>
    </form>
  );
}
