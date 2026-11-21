import type { AdminViewServerProps } from "payload";
import { getSafeRedirect } from "payload/shared";
import { redirect } from "next/navigation";
import { AuthLayout } from "../../shell/AuthLayout";
import { LoginForm } from "./LoginForm";

export function LoginView({ initPageResult, searchParams }: AdminViewServerProps) {
  const { req } = initPageResult;
  const adminRoute = req.payload.config.routes.admin;
  const redirectTo = getSafeRedirect({ fallbackTo: adminRoute, redirectTo: (searchParams?.redirect as string | undefined) ?? "" });
  if (req.user) redirect(redirectTo);

  return (
    <AuthLayout title="Logowanie do panelu urzędnika" lead="Zaloguj się kontem służbowym, aby wgrywać formularze, sprawdzać uwagi i publikować e-usługi.">
      <LoginForm redirectTo={redirectTo} />
    </AuthLayout>
  );
}
