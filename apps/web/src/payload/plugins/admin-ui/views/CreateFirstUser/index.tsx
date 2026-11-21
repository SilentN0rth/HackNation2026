import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import { AuthLayout } from "../../shell/AuthLayout";
import { CreateFirstUserForm } from "./CreateFirstUserForm";

export async function CreateFirstUserView({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult;
  const { config } = req.payload;
  const { totalDocs } = await req.payload.count({ collection: config.admin.user as "users", overrideAccess: true });
  // Konto administratora zakłada się tylko raz – potem obowiązuje zwykłe logowanie.
  if (totalDocs > 0) redirect(`${config.routes.admin}${config.admin.routes.login}`);

  return (
    <AuthLayout
      title="Pierwsze konto administratora"
      lead="Panel nie ma jeszcze użytkowników. Załóż konto administratora – kolejne konta urzędników dodasz już w panelu."
    >
      <CreateFirstUserForm adminRoute={config.routes.admin} />
    </AuthLayout>
  );
}
