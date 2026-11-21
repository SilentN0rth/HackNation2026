"use client";

import { useConfig } from "@payloadcms/ui";
import Link from "next/link";
import { formatAdminURL } from "payload/shared";

/** admin.components.logout.Button – link do widoku wylogowania (ten sam wygląd co w NavBar). */
export function LogoutButton() {
  const { config } = useConfig();
  const href = formatAdminURL({ adminRoute: config.routes.admin, path: config.admin.routes.logout as `/${string}`, serverURL: config.serverURL });
  return (
    <Link href={href} className="ef-ui press rounded-md bg-default px-3 py-1.5 text-sm font-medium text-ink transition-colors duration-150 hover:bg-default-hover">
      Wyloguj
    </Link>
  );
}
