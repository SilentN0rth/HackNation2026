/**
 * Plugin panelu urzędnika (/official): własny shell, logowanie i konto w stylu strony głównej.
 * Logika zostaje Payloadowa (useAuth, endpointy /users/*), podmieniamy tylko widoki i komponenty.
 *
 * Plugin DOKŁADA komponenty do admin.components – tablice są sklejane, a widoki i grafiki ustawiane
 * tylko wtedy, gdy konfiguracja (np. fragmenty C/D/E) nie zdefiniowała ich wcześniej.
 */
import type { AdminViewConfig, Config, Plugin } from "payload";

const DIR = "@/payload/plugins/admin-ui";

export type AdminUiOptions = {
  /** Wyłączenie pluginu bez zmiany konfiguracji (np. do porównania z natywnym panelem). */
  enabled?: boolean;
};

type Views = Record<string, AdminViewConfig>;

/**
 * Widoki logowania i konta – klucze zgodne z wbudowanymi widokami Payloada.
 * /reset/:token ma w Payloadzie stałą trasę bez możliwości podmiany – stylujemy go w theme/admin.css.
 */
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
        // Strona publiczna nie ma ciemnego motywu – panel też zawsze jasny (inaczej Payload bierze motyw z systemu).
        theme: admin.theme ?? "light",
        avatar: admin.avatar ?? { Component: `${DIR}/shell/Avatar#Avatar` },
        // Pasek zapisu dokumentu jest przyklejony do dołu ekranu – toasty u góry go nie zasłaniają (zwłaszcza na telefonie).
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
