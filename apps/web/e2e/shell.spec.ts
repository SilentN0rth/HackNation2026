import { expect, test } from "@playwright/test";
import { login, screenshot, SEED_USER, trackConsoleErrors } from "./helpers";

/** Plugin admin-ui: logowanie, konto, nawigacja i wylogowanie w stylu strony publicznej. */
test.describe("panel – shell (plugin admin-ui)", () => {
  let errors: string[];

  test.beforeEach(({ page }) => {
    // 401 przy złym haśle to oczekiwana odpowiedź API, nie błąd strony.
    errors = trackConsoleErrors(page, [/status of 401/]);
  });

  test.afterEach(() => {
    expect(errors, "błędy w konsoli przeglądarki").toEqual([]);
  });

  test("logowanie ma wygląd strony publicznej, bez znaku Payload", async ({ page }, testInfo) => {
    await page.goto("/official/login");
    await expect(page.getByRole("heading", { level: 1, name: "Logowanie do panelu urzędnika" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^e-\s?Formularze$/ })).toBeVisible();
    await expect(page.getByText("Payload", { exact: true })).toHaveCount(0);
    await expect(page.locator(".login__brand")).toHaveCount(0);
    // Jasny motyw niezależnie od ustawień systemu.
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await screenshot(page, testInfo, "shell-login");
  });

  test("złe hasło pokazuje komunikat po polsku i zostaje na logowaniu", async ({ page }) => {
    await page.goto("/official/login");
    await page.locator("#field-email").fill(SEED_USER.email);
    await page.locator("#field-password").fill("zle-haslo");
    await page.getByRole("button", { name: "Zaloguj się" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Nieprawidłowy e-mail lub hasło.");
    await expect(page).toHaveURL(/\/official\/login/);
  });

  test("przypomnienie hasła nie zdradza, czy konto istnieje", async ({ page }, testInfo) => {
    await page.goto("/official/login");
    await page.getByRole("link", { name: "Nie pamiętasz hasła?" }).click();
    await expect(page).toHaveURL(/\/official\/forgot/);
    await page.getByLabel("Adres e-mail").fill("nikt@example.gov.pl");
    await page.getByRole("button", { name: "Wyślij link" }).click();
    await expect(page.getByRole("status").filter({ hasText: /\S/ })).toContainText("Jeśli konto o tym adresie istnieje");
    await screenshot(page, testInfo, "shell-forgot");
  });

  test("pierwsze konto: przekierowanie do logowania, gdy użytkownicy już są", async ({ page }) => {
    await page.goto("/official/create-first-user");
    await expect(page).toHaveURL(/\/official\/login/);
  });

  test("nawigacja: poziomy pasek z kolekcjami i zaznaczoną bieżącą stroną", async ({ page }, testInfo) => {
    await login(page);
    const nav = page.getByRole("navigation", { name: "Panel urzędnika" });
    await expect(nav.getByRole("link", { name: "Pulpit" })).toHaveAttribute("aria-current", "page");
    await nav.getByRole("link", { name: "Formularze" }).click();
    await expect(page).toHaveURL(/\/official\/collections\/forms/);
    await expect(nav.getByRole("link", { name: "Formularze" })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".nav")).toHaveCount(0); // boczne menu Payloada zastąpione
    await screenshot(page, testInfo, "shell-nav");
  });

  test("konto: zmiana imienia i nazwiska zapisuje się w Payloadzie", async ({ page }, testInfo) => {
    await login(page);
    // Desktop: imię i nazwisko w nagłówku, mobile: „Konto” w pasku nawigacji.
    await page.locator('a[href$="/account"]:visible').first().click();
    await expect(page).toHaveURL(/\/official\/account/);
    await expect(page.getByRole("heading", { level: 1, name: "Twoje konto" })).toBeVisible();

    const name = page.getByLabel("Imię i nazwisko");
    await name.fill("Anna Nowak-Test");
    await page.getByRole("button", { name: "Zapisz dane" }).click();
    await expect(page.getByText("Zapisano dane konta.")).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("Imię i nazwisko")).toHaveValue("Anna Nowak-Test");

    // Przywrócenie danych z seeda dla pozostałych testów.
    await page.getByLabel("Imię i nazwisko").fill(SEED_USER.name);
    await page.getByRole("button", { name: "Zapisz dane" }).click();
    await expect(page.getByText("Zapisano dane konta.").first()).toBeVisible();
    await screenshot(page, testInfo, "shell-account");
  });

  test("konto: walidacja nowego hasła po stronie przeglądarki", async ({ page }) => {
    await login(page);
    await page.goto("/official/account");
    await page.getByLabel("Nowe hasło", { exact: true }).fill("krotkie");
    await page.getByLabel("Powtórz nowe hasło").fill("inne");
    await page.getByRole("button", { name: "Zmień hasło" }).click();
    await expect(page.getByText("Hasło musi mieć co najmniej 12 znaków.")).toBeVisible();
    await expect(page.getByText("Hasła nie są takie same.")).toBeVisible();
  });

  test("preferencje: gęstość trafia do globala settings i na <html>", async ({ page }) => {
    await login(page);
    await page.goto("/official/account");
    // React Aria ukrywa natywny input – klikamy etykietę jak użytkownik.
    await page.getByText("Zwarta", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-density", "compact");
    await page.reload();
    await expect(page.getByRole("radio", { name: "Zwarta" })).toBeChecked();
    await page.getByText("Wygodna", { exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-density", "comfortable");
  });

  test("wylogowanie kończy sesję", async ({ page }, testInfo) => {
    await login(page);
    await page.getByRole("link", { name: "Wyloguj" }).first().click();
    await expect(page.getByText("Wylogowano.")).toBeVisible();
    await screenshot(page, testInfo, "shell-logout");
    await page.goto("/official");
    await expect(page).toHaveURL(/\/official\/login/);
  });
});
