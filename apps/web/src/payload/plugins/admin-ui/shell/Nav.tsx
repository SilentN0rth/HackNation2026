import { getTranslation } from "@payloadcms/translations";
import { RenderServerComponent } from "@payloadcms/ui/elements/RenderServerComponent";
import { EntityType, groupNavItems, type EntityToGroup } from "@payloadcms/ui/shared";
import type { ServerProps, VisibleEntities } from "payload";
import { formatAdminURL } from "payload/shared";
import { NavBar, type NavGroup } from "./NavBar";

type Props = ServerProps & { visibleEntities?: VisibleEntities };

/**
 * Nawigacja panelu (admin.components.Nav): poziomy pasek jak na stronie publicznej zamiast bocznego menu.
 * Pozycje liczone tak jak w domyślnej nawigacji Payloada (widoczne kolekcje i globale, grupy z admin.group).
 */
export function Nav(props: Props) {
  const { payload, permissions, i18n, user, visibleEntities, params, searchParams, locale } = props;
  if (!payload?.config || !user) return null;
  const { config } = payload;
  const adminRoute = config.routes.admin;
  const url = (path: `/${string}`) => formatAdminURL({ adminRoute, path, serverURL: config.serverURL });

  const groups = groupNavItems(
    [
      ...config.collections
        .filter(({ slug }) => visibleEntities?.collections.includes(slug))
        .map((entity): EntityToGroup => ({ type: EntityType.collection, entity })),
      ...config.globals
        .filter(({ slug }) => visibleEntities?.globals.includes(slug))
        .map((entity): EntityToGroup => ({ type: EntityType.global, entity })),
    ],
    permissions!,
    i18n,
  );

  const navGroups: NavGroup[] = groups.map((g) => ({
    label: g.label,
    links: g.entities.map((e) => ({
      href: url(e.type === EntityType.collection ? `/collections/${e.slug}` : `/globals/${e.slug}`),
      label: getTranslation(e.label, i18n),
    })),
  }));

  const serverProps = { i18n, locale, params, payload, permissions, searchParams, user };
  const { beforeNavLinks, afterNavLinks } = config.admin.components ?? {};
  const slot = (components: typeof beforeNavLinks) =>
    components?.length ? RenderServerComponent({ Component: components, importMap: payload.importMap, serverProps }) : null;

  return (
    <NavBar
      home={url("/")}
      account={url(config.admin.routes.account as `/${string}`)}
      logout={url(config.admin.routes.logout as `/${string}`)}
      userName={String((user as { name?: string }).name ?? user.email)}
      groups={navGroups}
      before={slot(beforeNavLinks)}
      after={slot(afterNavLinks)}
    />
  );
}
