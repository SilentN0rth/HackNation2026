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
  await page.waitForURL((url) => url.pathname === "/official" || url.pathname === "/official/");
  await expect(page.locator(".dashboard, [class*=dashboard]").first()).toBeVisible();
}

/** Zrzut całej strony do e2e/__screens__/<projekt>/<nazwa>.png (desktop / mobile). */
export async function screenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.waitForLoadState("networkidle").catch(() => undefined);
  const file = path.join(SCREENS_DIR, testInfo.project.name, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true, animations: "disabled" });
  return file;
}

/** Zbiera błędy konsoli i nieobsłużone wyjątki strony; sprawdź na końcu testu `expect(errors).toEqual([])`. */
export function trackConsoleErrors(page: Page, ignore: RegExp[] = []): string[] {
  const errors: string[] = [];
  const keep = (text: string) => !ignore.some((re) => re.test(text));
  page.on("console", (msg) => {
    if (msg.type() === "error" && keep(msg.text())) errors.push(msg.text());
  });
  page.on("pageerror", (err) => {
    if (keep(err.message)) errors.push(err.message);
  });
  return errors;
}
