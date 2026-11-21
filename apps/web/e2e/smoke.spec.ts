import { expect, test } from "@playwright/test";
import { login, screenshot, SEED_USER, trackConsoleErrors } from "./helpers";

test.describe("smoke", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    errors = trackConsoleErrors(page);
  });

  test.afterEach(() => {
    expect(errors, "błędy w konsoli przeglądarki").toEqual([]);
  });

  test("strona główna się renderuje", async ({ page }, testInfo) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.getByRole("link", { name: /^e-\s?Formularze$/ })).toBeVisible();
    await screenshot(page, testInfo, "home");
  });

  test("obywatel widzi opublikowane usługi z Payloada", async ({ page }, testInfo) => {
    await page.goto("/citizen");
    await expect(page.getByRole("heading", { name: "Zgłoszenie odbioru odpadów wielkogabarytowych" })).toBeVisible();
    // Wersje robocze nie wyciekają do obywatela.
    await expect(page.getByText("Wniosek o przyznanie dodatku mieszkaniowego")).toHaveCount(0);
    await screenshot(page, testInfo, "citizen");
  });

  test("obywatel otwiera formularz i swoje sprawy", async ({ page }, testInfo) => {
    await page.goto("/citizen");
    await page.getByRole("heading", { name: "Zgłoszenie odbioru odpadów wielkogabarytowych" }).click();
    await expect(page).toHaveURL(/\/citizen\/form\/\d+/);
    await expect(page.getByText("Zgłoszenie odbioru odpadów wielkogabarytowych").first()).toBeVisible();
    await screenshot(page, testInfo, "citizen-form");
    await page.goto("/citizen/applications");
    await expect(page.getByText("Zgłoszenie odbioru odpadów wielkogabarytowych").first()).toBeVisible();
    await screenshot(page, testInfo, "citizen-applications");
  });

  test("/official pokazuje logowanie", async ({ page }, testInfo) => {
    await page.goto("/official");
    await page.waitForURL(/\/official\/login/);
    await expect(page.locator("#field-email")).toBeVisible();
    await expect(page.locator("#field-password")).toBeVisible();
    await screenshot(page, testInfo, "official-login");
  });

  test("logowanie kontem z seeda prowadzi na pulpit (HeroUI działa w panelu)", async ({ page }, testInfo) => {
    await login(page);
    const dashboard = page.getByTestId("panel-dashboard");
    await expect(dashboard).toBeVisible();
    const cta = dashboard.getByRole("link", { name: "Nowy z pliku" }).first();
    await expect(cta).toBeVisible();
    // Style załadowane: główne wezwanie do działania ma tło w kolorze akcentu, a nie przezroczyste.
    const bg = await cta.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bg).not.toBe("rgba(0, 0, 0, 0)");
    await screenshot(page, testInfo, "official-dashboard");
  });

  test("lista formularzy w panelu się ładuje", async ({ page }, testInfo) => {
    await login(page);
    await page.goto("/official/collections/forms");
    await expect(page.getByText("Wniosek o przyznanie dodatku mieszkaniowego").first()).toBeVisible();
    await expect(page.getByText("Zgłoszenie odbioru odpadów wielkogabarytowych").first()).toBeVisible();
    await screenshot(page, testInfo, "official-forms-list");
  });

  test("stare adresy panelu przekierowują do Payloada", async ({ page }) => {
    await login(page);
    await page.goto("/official/audit");
    await expect(page).toHaveURL(/\/official\/collections\/audit-log/);
    await expect(page.getByText(SEED_USER.name).first()).toBeVisible();
  });
});
