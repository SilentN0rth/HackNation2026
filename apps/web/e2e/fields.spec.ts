/** Pola panelu (agent D): komponenty HeroUI dla każdego typu pola, zapis i odczyt przez Payload. */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { login, screenshot, trackConsoleErrors } from "./helpers";

// 1×1 PNG – rozpoznawany po zawartości jako image/png (Media.mimeTypes).
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

// Szum spoza pól (np. FastAPI niedostępne lokalnie, HMR dev serwera).
const IGNORE = [/Failed to load resource/i, /\[Fast Refresh\]/, /webpack-hmr|turbopack/i, /favicon/i];

const field = (page: Page, path: string) => page.locator(`[data-path="${path}"]`).first();

/** Rozwija edytor JSON (jeśli zwinięty) i zwraca jego textarea. */
async function openJson(page: Page, path: string) {
  const toggle = field(page, path).getByRole("button", { name: /^(Zwiń|Rozwiń)$/ });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  const editor = field(page, path).locator('[data-testid="json-editor"]');
  await expect(editor).toBeVisible();
  return editor;
}

async function saveGlobal(page: Page, slug: string) {
  // Dokładna ścieżka – panel wysyła też POST /globals/<slug>/access, który nie jest zapisem.
  const done = page.waitForResponse((r) => new URL(r.url()).pathname === `/api/payload/globals/${slug}` && ["POST", "PATCH"].includes(r.request().method()) && r.status() < 400);
  await page.locator("[data-testid=save]").click();
  await done;
  // Payload po zapisie przeładowuje stan formularza – poczekaj na koniec przetwarzania.
  await page.waitForLoadState("networkidle").catch(() => undefined);
}

async function tabTo(page: Page, target: Locator, max = 60) {
  const id = await target.getAttribute("id");
  for (let i = 0; i < max; i++) {
    await page.keyboard.press("Tab");
    if ((await page.evaluate(() => document.activeElement?.id)) === id) return;
  }
  throw new Error(`Nie udało się dojść klawiszem Tab do #${id}`);
}

test.describe("pola panelu (HeroUI)", () => {
  test("wymagane pola, tekst i textarea – walidacja, fokus z klawiatury, zapis i odczyt", async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page, IGNORE);
    await login(page);
    await page.goto("/official/collections/statute-chunks/create");
    const chunkId = page.locator("#field-chunkId");
    await expect(chunkId).toBeVisible();

    // Każde pole to nasz komponent (data-pf-field), nie natywne pole Payloada.
    await expect(page.locator(".pf-field")).toHaveCount(4);
    await expect(page.locator(".field-type:not(.pf-field)")).toHaveCount(0);

    // Zapis bez danych → błędy z walidacji Payloada wjeżdżają pod polami.
    await page.locator("[data-testid=save]").click();
    await expect(page.locator('[data-testid="field-error"]')).toHaveCount(4);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await expect(field(page, "act").getByRole("alert")).toContainText(/wymagane/i);
    await screenshot(page, testInfo, "fields-required-errors");

    // Fokus z klawiatury: pierwsze pole ma widoczny pierścień (kolor akcentu).
    await page.locator("body").click({ position: { x: 5, y: 5 } });
    await tabTo(page, chunkId);
    const ring = await chunkId.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle} ${s.outlineColor} ${s.boxShadow} ${s.borderColor}`;
    });
    expect(ring).not.toMatch(/^none rgb\(0, 0, 0\) none rgb\(201, 202, 204\)$/);

    const unique = `e2e-fields-${Date.now()}`;
    await chunkId.fill(unique);
    await page.locator("#field-act").fill("Kodeks postępowania administracyjnego");
    await page.locator("#field-unit").fill("art. 63 § 1");
    await page.locator("#field-text").fill("Podania mogą być wnoszone pisemnie,\nza pomocą telefaksu lub ustnie.");
    // Błąd znika po poprawieniu wartości.
    await expect(field(page, "act").getByRole("alert")).toHaveCount(0);

    await Promise.all([page.waitForURL(/statute-chunks\/\d+/), page.locator("[data-testid=save]").click()]);
    await page.reload();
    await expect(page.locator("#field-chunkId")).toHaveValue(unique);
    await expect(page.locator("#field-unit")).toHaveValue("art. 63 § 1");
    await expect(page.locator("#field-text")).toHaveValue(/ustnie\.$/);
    await screenshot(page, testInfo, "fields-statute-edit");
    expect(errors).toEqual([]);
  });

  test("formularz: tekst, liczba, segmenty, plik (upload + biblioteka), JSON, pola tylko do odczytu", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "zapis sprawdzany na desktopie, mobile – tylko wygląd");
    const errors = trackConsoleErrors(page, IGNORE);
    await login(page);
    await page.goto("/official/collections/forms/create");
    const title = `E2E pola ${Date.now()}`;
    await page.locator("#field-title").fill(title);
    await page.locator("#field-summary").fill("Opis testowy dla obywatela.");

    // Liczba: wpisanie + stepper HeroUI.
    const minutes = page.locator("#field-estimatedMinutes");
    await minutes.fill("4");
    await field(page, "estimatedMinutes").getByRole("button", { name: "Zwiększ" }).click();
    await expect(minutes).toHaveValue("5");

    // Segmenty statusu.
    const review = field(page, "status").getByRole("radio", { name: "Do weryfikacji" }).or(field(page, "status").getByRole("button", { name: "Do weryfikacji" }));
    await review.click();
    await expect(review).toHaveAttribute("aria-checked", "true").catch(async () => expect(review).toHaveAttribute("aria-pressed", "true"));

    // Plik: upload przez REST Payloada → podgląd.
    await field(page, "source").locator('[data-testid="upload-input"]').setInputFiles({ name: "blankiet-e2e.png", mimeType: "image/png", buffer: PNG });
    await expect(field(page, "source").locator('[data-testid="upload-preview"]')).toContainText("blankiet-e2e");

    // JSON: niepoprawny → błąd na żywo i blokada zapisu; poprawny → zapis.
    const flags = field(page, "lintFlags");
    const editor = await openJson(page, "lintFlags");
    await editor.fill("[ { nie json");
    await expect(flags.getByRole("alert")).toContainText("Niepoprawny JSON");
    await screenshot(page, testInfo, "fields-forms-json-error");
    await editor.fill("[]");
    await expect(flags.getByRole("alert")).toHaveCount(0);

    await screenshot(page, testInfo, "fields-forms-create");
    await Promise.all([page.waitForURL(/forms\/\d+/, { timeout: 30_000 }), page.locator("[data-testid=save-draft]").click()]);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await page.reload();
    await expect(page.locator("#field-title")).toHaveValue(title);
    await expect(page.locator("#field-summary")).toHaveValue("Opis testowy dla obywatela.");
    await expect(page.locator("#field-estimatedMinutes")).toHaveValue("5");
    await expect(field(page, "source").locator('[data-testid="upload-preview"]')).toContainText("blankiet-e2e");
    // Pola tylko do odczytu (select, number) są wyszarzone i nieedytowalne.
    await expect(page.locator("#field-aiStatus")).toHaveAttribute("readonly", "");

    // Wybór pliku z biblioteki zamiast wgrywania.
    await field(page, "source").getByRole("button", { name: "Usuń plik" }).click();
    await expect(field(page, "source").locator('[data-testid="upload-dropzone"]')).toBeVisible();
    await field(page, "source").getByRole("button", { name: "Wybierz z biblioteki" }).click();
    await page.getByPlaceholder("Szukaj w bibliotece…").fill("blankiet-e2e");
    // Lista odświeża się po debounce wyszukiwania – czekaj na wynik pasujący do frazy.
    const picked = page.getByRole("option", { name: /blankiet-e2e/ }).first();
    await expect(picked).toBeVisible();
    await picked.click();
    await expect(field(page, "source").locator('[data-testid="upload-preview"]')).toContainText("blankiet-e2e");
    await screenshot(page, testInfo, "fields-forms-edit");
    expect(errors).toEqual([]);
  });

  test("wniosek: relacja z wyszukiwaniem, segmenty, JSON wymagany", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "mobile", "zapis sprawdzany na desktopie");
    const errors = trackConsoleErrors(page, IGNORE);
    await login(page);
    const forms = await (await page.request.get("/api/payload/forms?limit=1&depth=0&sort=title")).json();
    const target = forms.docs[0] as { id: number; title: string };

    await page.goto("/official/collections/applications/create");
    const combo = page.locator("#field-form");
    await combo.click();
    await combo.fill(target.title.slice(0, 6));
    const option = page.getByRole("option", { name: target.title });
    await expect(option).toBeVisible();
    await option.click();
    await expect(combo).toHaveValue(target.title);

    await field(page, "status").getByText("Wysłany").click();
    const values = await openJson(page, "values");
    await values.fill('{ "person.fullName": "Jan Kowalski" }');
    await screenshot(page, testInfo, "fields-applications-create");

    await Promise.all([page.waitForURL(/applications\/\d+/), page.locator("[data-testid=save]").click()]);
    await page.reload();
    await expect(page.locator("#field-form")).toHaveValue(target.title);
    const persisted = await openJson(page, "values");
    await expect(persisted).toHaveValue(/Jan Kowalski/);
    // UPO nadawany przy wysłaniu – pole tylko do odczytu.
    await expect(page.locator("#field-confirmationNo")).toHaveValue(/^UPO\//);
    await expect(page.locator("#field-confirmationNo")).toHaveAttribute("readonly", "");
    expect(errors).toEqual([]);
  });

  test("globale: select, segmenty, przełącznik i JSON rejestru", async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page, IGNORE);
    await login(page);
    await page.goto("/official/globals/settings");
    await expect(field(page, "defaultView")).toBeVisible();
    await screenshot(page, testInfo, "fields-settings");
    if (testInfo.project.name === "mobile") return expect(errors).toEqual([]);

    // Select (HeroUI) – wybór z listy.
    await field(page, "defaultView").getByRole("button").first().click();
    await page.getByRole("option", { name: "Formularze" }).click();
    await field(page, "density").getByText("Zwarta").click();
    const before = await page.locator('[data-path="animations"] input[type="checkbox"]').isChecked();
    await field(page, "animations").getByText("Animacje").click();
    await saveGlobal(page, "settings");
    await page.reload();
    await expect(field(page, "defaultView")).toContainText("Formularze");
    await expect(page.locator('[data-path="animations"] input[type="checkbox"]')).toBeChecked({ checked: !before });
    // Przywróć ustawienia (test idempotentny).
    await field(page, "defaultView").getByRole("button").first().click();
    await page.getByRole("option", { name: "Pulpit" }).click();
    await field(page, "density").getByText("Wygodna").click();
    await field(page, "animations").getByText("Animacje").click();
    await saveGlobal(page, "settings");

    // JSON w globalu rejestru.
    await page.goto("/official/globals/registry");
    const editor = await openJson(page, "prefill");
    const original = await editor.inputValue();
    await editor.fill("{ zepsuty");
    await expect(field(page, "prefill").getByRole("alert")).toContainText("Niepoprawny JSON");
    // Zapis z błędnym JSON-em jest blokowany walidacją kliencką.
    await page.locator("[data-testid=save]").click();
    await expect(field(page, "prefill").getByRole("alert")).toBeVisible();
    // Odrzucony zapis kończy się dopiero po walidacji stanu formularza na serwerze – kolejny klik przed tym jest ignorowany.
    await page.waitForLoadState("networkidle").catch(() => undefined);
    const marker = `E2E ${Date.now()}`;
    const next = { ...(JSON.parse(original || "{}") as Record<string, unknown>), "e2e.marker": marker };
    await editor.fill(JSON.stringify(next, null, 2));
    await expect(field(page, "prefill").getByRole("alert")).toHaveCount(0);
    await saveGlobal(page, "registry");
    await page.reload();
    const after = await openJson(page, "prefill");
    await expect(after).toHaveValue(new RegExp(marker));
    await screenshot(page, testInfo, "fields-registry-json");
    // Przywróć dane rejestru (prefill obywatela korzysta z nich w innych testach).
    await after.fill(original || "{}");
    await saveGlobal(page, "registry");
    expect(errors).toEqual([]);
  });

  test("użytkownik i plik: wygląd pól (desktop + mobile)", async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page, IGNORE);
    await login(page);
    await page.goto("/official/collections/forms/create");
    await expect(page.locator("#field-title")).toBeVisible();
    await screenshot(page, testInfo, "fields-forms-create-look");
    const users = await (await page.request.get("/api/payload/users?limit=1&depth=0")).json();
    await page.goto(`/official/collections/users/${users.docs[0].id}`);
    await expect(page.locator("#field-name")).toBeVisible();
    await screenshot(page, testInfo, "fields-users-edit");
    const media = await (await page.request.get("/api/payload/media?limit=1&depth=0")).json();
    if (media.docs[0]) {
      await page.goto(`/official/collections/media/${media.docs[0].id}`);
      await expect(page.locator("#field-alt")).toBeVisible();
      await screenshot(page, testInfo, "fields-media-edit");
    }
    expect(errors).toEqual([]);
  });

  test("tylko do odczytu: dziennik decyzji (relacje, select, textarea) i data publikacji", async ({ page }, testInfo) => {
    const errors = trackConsoleErrors(page, IGNORE);
    await login(page);
    const audit = await (await page.request.get("/api/payload/audit-log?limit=1&depth=0&sort=-createdAt")).json();
    test.skip(!audit.docs[0], "brak wpisów dziennika w bazie");
    await page.goto(`/official/collections/audit-log/${audit.docs[0].id}`);
    for (const [path, type] of [["form", "relationship"], ["user", "relationship"], ["action", "select"], ["details", "textarea"]] as const) {
      await expect(field(page, path)).toHaveAttribute("data-pf-field", type);
    }
    await expect(page.locator(".field-type:not(.pf-field)")).toHaveCount(0);
    await expect(page.locator("#field-details")).toHaveAttribute("readonly", "");
    await screenshot(page, testInfo, "fields-audit-readonly");

    const published = await (await page.request.get("/api/payload/forms?limit=1&depth=0&where[status][equals]=published")).json();
    if (published.docs[0]) {
      await page.goto(`/official/collections/forms/${published.docs[0].id}`);
      await expect(field(page, "publishedAt")).toHaveAttribute("data-pf-field", "date");
      await expect(field(page, "publishedAt")).toContainText(/\d{4}/);
      await expect(field(page, "publishedBy")).toHaveAttribute("data-pf-field", "relationship");
      await screenshot(page, testInfo, "fields-forms-published");
    }
    expect(errors).toEqual([]);
  });
});
