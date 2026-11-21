import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import { AuthLayout } from "../../shell/AuthLayout";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export function ForgotPasswordView({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult;
  const { config } = req.payload;
  if (req.user) redirect(`${config.routes.admin}${config.admin.routes.account}`);
  return (
    <AuthLayout title="Przypomnienie hasła" lead="Podaj adres e-mail konta. Wyślemy na niego link do ustawienia nowego hasła.">
      <ForgotPasswordForm loginHref={`${config.routes.admin}${config.admin.routes.login}`} />
    </AuthLayout>
  );
}
