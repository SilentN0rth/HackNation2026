import type { AdminViewServerProps } from "payload";
import { AuthLayout } from "../../shell/AuthLayout";
import { LogoutClient } from "./LogoutClient";

export function LogoutInactivityView(props: AdminViewServerProps) {
  return <LogoutView {...props} inactivity />;
}

export function LogoutView({ initPageResult, inactivity = false }: AdminViewServerProps & { inactivity?: boolean }) {
  const { config } = initPageResult.req.payload;
  return (
    <AuthLayout
      title={inactivity ? "Wylogowaliśmy Cię" : "Wylogowanie"}
      lead={inactivity ? "Sesja wygasła po okresie bezczynności. Zaloguj się ponownie, aby kontynuować." : "Kończymy sesję w panelu urzędnika."}
    >
      <LogoutClient loginHref={`${config.routes.admin}${config.admin.routes.login}`} />
    </AuthLayout>
  );
}
