/** Wspólne pomocniki e2e dla wszystkich agentów: logowanie do panelu, zrzuty ekranu, błędy konsoli. */
import { expect, type Page, type TestInfo } from "@playwright/test";
import path from "node:path";

export const SEED_USER = {
  email: "urzednik@example.gov.pl",
  password: process.env.SEED_PASSWORD ?? "demo1234",
  name: "Anna Nowak",
};

export const SCREENS_DIR = path.join(import.meta.dirname, "__screens__");

/** Loguje urzędnika w panelu /official i czeka na pulpit. */
export async function login(page: Page, user: { email: string; password: string } = SEED_USER) {
  await page.goto("/official/login");
  await page.locator("#field-email").fill(user.email);
  await page.locator("#field-password").fill(user.password);
  await page.locator('form button[type="submit"]').click();
  // zaraz po logowaniu pulpit może przekierować do widoku z settings.defaultView – wchodzimy na pulpit wprost
  await page.waitForURL((url) => url.pathname.startsWith("/official") && !url.pathname.startsWith("/official/login"), { timeout: 60_000 });
  await page.goto("/official");
  await expect(page.getByTestId("panel-dashboard")).toBeVisible();
}

/** Zrzut całej strony do e2e/__screens__/<projekt>/<nazwa>.png (desktop / mobile). */
export async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const file = path.join(SCREENS_DIR, testInfo.project.name, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  return file;
}

/** Zbiera błędy konsoli i nieobsłużone wyjątki strony; sprawdź na końcu testu `expect(errors).toEqual([])`. */
/**
 * Ostrzeżenie o hydratacji, w którym jedyną różnicą jest `caret-color` na polach React Aria.
 * HTML z serwera tego stylu nie zawiera (sprawdzone curl-em) – dopisuje go przeglądarka
 * testowa przed hydratacją, więc to nie jest błąd aplikacji. Każda inna różnica nadal oblewa test.
 */
function isCaretColorOnlyHydrationWarning(text: string): boolean {
  if (!text.includes("hydrated but some attributes")) return false;
  const diff = text.split("\n").filter((line) => /^\s*[+-]\s+\S/.test(line) && !/^\s*[+-]\s+(<|\.\.\.)/.test(line));
  return diff.length > 0 && diff.every((line) => /caret-?color/i.test(line));
}

export function trackConsoleErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  const keep = (text: string) => !isCaretColorOnlyHydrationWarning(text) && !ignore.some((re) => re.test(text));
  page.on("console", (msg) => {
    if (msg.type() === "error" && keep(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    if (keep(err.message)) errors.push(err.message);
  });
  return errors;
}
