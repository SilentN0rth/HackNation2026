import Link from "next/link";
import type { AdminViewServerProps } from "payload";
import { AuthLayout } from "../../shell/AuthLayout";
import { primaryLink } from "../../theme";

export function UnauthorizedView({ initPageResult }: AdminViewServerProps) {
  const { config } = initPageResult.req.payload;
  return (
    <AuthLayout title="Brak dostępu" lead="To konto nie ma uprawnień do panelu urzędnika. Zaloguj się innym kontem albo poproś administratora o dostęp.">
      <Link href={`${config.routes.admin}${config.admin.routes.logout}`} className={primaryLink}>
        Wyloguj i zmień konto
      </Link>
    </AuthLayout>
  );
}
