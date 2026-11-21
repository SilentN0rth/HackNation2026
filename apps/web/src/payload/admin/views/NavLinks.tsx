"use client";

import { Link } from "@heroui/react";
import { usePathname } from "next/navigation";
import { uiScope } from "./motion";
import { PANEL_VIEWS, type PanelView } from "./routes";
import { PanelRouter } from "./ui/bits";

/** Pulpit i kolekcje (formularze, dziennik) ma już nawigacja pluginu – tu tylko widoki bez kolekcji. */
const OWN: PanelView["key"][] = ["upload"];

const isActive = (v: PanelView, pathname: string) =>
  v.key === "dashboard" ? pathname === v.path || pathname === `${v.path}/` : v.match.some((m) => pathname.startsWith(m));

/** admin.components.beforeNavLinks – linki do widoków agenta E w poziomej nawigacji. */
export function NavLinks() {
  const pathname = usePathname() ?? "";
  return (
    <PanelRouter>
      <span className={`${uiScope} contents`}>
        {PANEL_VIEWS.filter((v) => OWN.includes(v.key)).map((v) => {
          const active = isActive(v, pathname);
          return (
            <Link
              key={v.key}
              href={v.path}
              aria-current={active ? "page" : undefined}
              data-panel-view={v.key}
              className="nav-link flex items-center py-3 whitespace-nowrap no-underline"
            >
              {v.label}
            </Link>
          );
        })}
      </span>
    </PanelRouter>
  );
}
