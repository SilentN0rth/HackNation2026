import type { AdminViewConfig, Config, Plugin } from "payload";

const DIR = "@/payload/plugins/admin-ui";

export type AdminUiOptions = {
  enabled?: boolean;
};

type Views = Record<string, AdminViewConfig>;

const VIEWS: Views = {
  login: { Component: `${DIR}/views/Login#LoginView` },
  createFirstUser: { Component: `${DIR}/views/CreateFirstUser#CreateFirstUserView` },
  forgot: { Component: `${DIR}/views/ForgotPassword#ForgotPasswordView` },
  account: { Component: `${DIR}/views/Account#AccountView` },
  logout: { Component: `${DIR}/views/Logout#LogoutView` },
  inactivity: { Component: `${DIR}/views/Logout#LogoutInactivityView` },
  unauthorized: { Component: `${DIR}/views/Unauthorized#UnauthorizedView` },
};

export const adminUiPlugin =
  ({ enabled = true }: AdminUiOptions = {}): Plugin =>
  (config: Config): Config => {
    if (!enabled) return config;
    const admin = config.admin ?? {};
    const components = admin.components ?? {};

    return {
      ...config,
      admin: {
        ...admin,
        theme: admin.theme ?? "light",
        avatar: admin.avatar ?? { Component: `${DIR}/shell/Avatar#Avatar` },
        toast: { position: "top-right", ...admin.toast },
        meta: {
          titleSuffix: " · e-Formularze",
          icons: [
            { rel: "icon", type: "image/svg+xml", url: "/icons/favicon.svg" },
            { rel: "apple-touch-icon", url: "/icons/apple-touch-icon.png" },
          ],
          ...admin.meta,
        },
        components: {
          ...components,
          providers: [`${DIR}/theme/Providers#Providers`, ...(components.providers ?? [])],
          graphics: {
            Logo: `${DIR}/shell/Logo#Logo`,
            Icon: `${DIR}/shell/Logo#Icon`,
            ...components.graphics,
          },
          Nav: components.Nav ?? `${DIR}/shell/Nav#Nav`,
          logout: { Button: `${DIR}/shell/LogoutButton#LogoutButton`, ...components.logout },
          views: { ...VIEWS, ...components.views },
        },
      },
    };
  };
