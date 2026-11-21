import type { AdminViewServerProps } from "payload";
import { redirect } from "next/navigation";
import { heading } from "../../theme";
import { AccountForms } from "./AccountForms";
import { AccountStepNav } from "./AccountStepNav";

/** Konto (/official/account): dane profilu, zmiana hasła i preferencje panelu. */
export function AccountView({ initPageResult }: AdminViewServerProps) {
  const { req } = initPageResult;
  const { config } = req.payload;
  if (!req.user) redirect(`${config.routes.admin}${config.admin.routes.login}`);
  const user = req.user as unknown as { id: string | number; email: string; name?: string; initials?: string; role?: string };

  return (
    <div className="ef-ui ef-page mx-auto w-full max-w-7xl px-5 pt-10 pb-20 sm:px-8 sm:pt-14">
      <AccountStepNav />
      <h1 className={heading.h1}>Twoje konto</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-2">Dane widoczne w dzienniku decyzji, hasło i ustawienia panelu.</p>
      <AccountForms
        user={{ id: user.id, email: user.email, name: user.name ?? "", initials: user.initials ?? "", role: user.role === "admin" ? "Administrator" : "Urzędnik" }}
      />
    </div>
  );
}
