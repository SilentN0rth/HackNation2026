"use client";

import { useAuth } from "@payloadcms/ui";
import type { UserWithToken } from "@payloadcms/ui";
import type { ClientUser } from "payload";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormAlert, SubmitButton, TextInput } from "../../shell/FormBits";
import { PayloadRestError, useUsersApi } from "../../lib/useUsersApi";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const { setUser } = useAuth();
  const { request, adminUrl, adminRoutes } = useUsersApi();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await request<UserWithToken<ClientUser>>("/login", { body: { email, password } });
      setUser(data);
      router.replace(redirectTo);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof PayloadRestError && err.status === 401
          ? "Nieprawidłowy e-mail lub hasło."
          : err instanceof Error
            ? err.message
            : "Nie udało się zalogować.",
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6" aria-busy={busy}>
      <FormAlert message={error} />
      <TextInput inputId="field-email" name="email" type="email" label="Adres e-mail" autoComplete="username" required autoFocus value={email} onChange={setEmail} />
      <TextInput inputId="field-password" name="password" type="password" label="Hasło" autoComplete="current-password" required value={password} onChange={setPassword} />
      <div className="flex flex-col-reverse items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={adminUrl(adminRoutes.forgot as `/${string}`)} className="link-arrow text-sm">
          Nie pamiętasz hasła?
        </Link>
        <SubmitButton busy={busy}>Zaloguj się</SubmitButton>
      </div>
    </form>
  );
}
