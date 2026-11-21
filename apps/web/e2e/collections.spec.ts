import { expect, test, type Page } from "@playwright/test";
import { login, screenshot, trackConsoleErrors } from "./helpers";

/** Widoki kolekcji (agent C): lista, edycja, wersje, pliki, dziennik, globale – na HeroUI. */

const API = "/api/payload";

async function createChunks(page: Page, prefix: string, n: number) {
  const ids: number[] = [];
  for (let i = 0; i < n; i++) {
    const res = await page.request.post(`${API}/statute-chunks`, {
      data: { chunkId: `${prefix}-${i}`, act: `Ustawa testowa ${prefix}`, unit: `art. ${i + 1} ${prefix}`, text: `Treść przepisu ${i + 1}.` },
    });
    expect(res.ok()).toBeTruthy();
    ids.push((await res.json()).doc.id);
  }
  return ids;
}

async function cleanupChunks(page: Page, prefix: string) {
  await page.request.delete(`${API}/statute-chunks?where[act][like]=${encodeURIComponent(prefix)}`);
}

test.describe("widoki kolekcji", () => {
  let errors: string[];

  test.beforeEach(async ({ page }) => {
    errors = trackConsoleErrors(page);
    await login(page);
  });

  test.afterEach(() => {
    expect(errors, "błędy w konsoli przeglądarki").toEqual([]);
  });

  test("lista formularzy: nagłówek, chipy statusu, wyszukiwanie, filtr, sortowanie", async ({ page }, testInfo) => {
    await page.goto("/official/collections/forms");
    const view = page.getByTestId("list-forms");
    await expect(view.getByRole("heading", { level: 1, name: "Formularze" })).toBeVisible();
    await expect(view.getByTestId("list-create")).toBeVisible();
    await expect(view.getByTestId("list-row").first()).toBeVisible();
    await expect(view.getByTestId("list-row").getByText("Opublikowany").first()).toBeVisible();
    await screenshot(page, testInfo, "collections-forms-list");

    // Wyszukiwanie
    await view.getByTestId("list-search").fill("odpadów");
    await expect(page).toHaveURL(/search=odpad/);
    await expect(view.getByTestId("list-row")).toHaveCount(1);
    await expect(view.getByText("Zgłoszenie odbioru odpadów wielkogabarytowych")).toBeVisible();
    await view.getByTestId("list-search").fill("zzzz-brak");
    await expect(view.getByText("Brak wyników")).toBeVisible();
    await screenshot(page, testInfo, "collections-forms-empty");
    await view.getByRole("button", { name: "Wyczyść filtry" }).click();
    await expect(view.getByTestId("list-row").first()).toBeVisible();

    // Filtr statusu
    await view.getByTestId("filter-status").getByRole("button").click();
    await page.getByRole("option", { name: "Opublikowany" }).click();
    await expect(page).toHaveURL(/where/);
    await expect(view.getByTestId("list-row")).toHaveCount(1);
    await view.getByTestId("filter-status").getByRole("button").click();
    await page.getByRole("option", { name: /wszystkie/ }).click();

    // Sortowanie po tytule
    await view.getByRole("columnheader", { name: /Tytuł/ }).click();
    await expect(page).toHaveURL(/sort=title/);
    const first = await view.getByTestId("list-row").first().innerText();
    await view.getByRole("columnheader", { name: /Tytuł/ }).click();
    await expect(page).toHaveURL(/sort=-title/);
    await expect(view.getByTestId("list-row").first()).not.toHaveText(first);
  });

  test("lista: kolumny, paginacja, liczba na stronie, zaznaczanie i usuwanie masowe", async ({ page }, testInfo) => {
    const prefix = `e2e-${Date.now()}`;
    await cleanupChunks(page, "e2e-");
    await createChunks(page, prefix, 5);
    await page.goto(`/official/collections/statute-chunks?limit=2&search=${prefix}`);
    const view = page.getByTestId("list-statute-chunks");
    await expect(view.getByTestId("list-row")).toHaveCount(2);
    await expect(view.getByTestId("list-pagination")).toContainText("Strona 1 z 3");

    // Paginacja
    await view.getByRole("button", { name: "Następna strona" }).click();
    await expect(view.getByTestId("list-pagination")).toContainText("Strona 2 z 3");
    await view.getByRole("button", { name: "Strona 3" }).click();
    await expect(view.getByTestId("list-row")).toHaveCount(1);

    // Liczba na stronie
    await view.getByTestId("list-per-page").getByRole("button").click();
    await page.getByRole("option", { name: "10", exact: true }).click();
    await expect(view.getByTestId("list-row")).toHaveCount(5);

    // Kolumny
    await view.getByTestId("list-columns").click();
    await page.getByRole("menuitemcheckbox", { name: "Treść" }).click();
    await page.keyboard.press("Escape");
    await expect(view.getByRole("columnheader", { name: /Treść/ })).toBeVisible();

    // Zaznaczanie + usuwanie z potwierdzeniem
    await view.getByTestId("list-row").nth(0).getByTestId("row-select").click();
    await view.getByTestId("list-row").nth(1).getByTestId("row-select").click();
    const bar = page.getByTestId("bulk-bar");
    await expect(bar).toContainText("Zaznaczono: 2");
    await screenshot(page, testInfo, "collections-bulk-bar");
    await bar.getByTestId("bulk-delete").click();
    const dialog = page.getByTestId("confirm-dialog");
    await expect(dialog).toContainText("Usunąć zaznaczone?");
    await screenshot(page, testInfo, "collections-bulk-confirm");
    await dialog.getByRole("button", { name: "Usuń" }).click();
    await expect(view.getByTestId("list-row")).toHaveCount(3);
    await expect(bar).toBeHidden();

    // Przywróć kolumnę i posprzątaj
    await view.getByTestId("list-columns").click();
    await page.getByRole("menuitemcheckbox", { name: "Treść" }).click();
    await page.keyboard.press("Escape");
    await cleanupChunks(page, prefix);
  });

  test("edycja dokumentu: zapis, licznik zmian, wersje i różnice", async ({ page }, testInfo) => {
    const list = await page.request.get(`${API}/forms?where[slug][exists]=true&limit=1&sort=createdAt&draft=true`);
    const form = (await list.json()).docs.find((d: { status: string }) => d.status !== "published") ?? (await list.json()).docs[0];
    await page.goto(`/official/collections/forms/${form.id}`);
    const doc = page.getByTestId("document-forms");
    await expect(doc.getByTestId("document-title")).toBeVisible();
    await expect(doc.getByTestId("tab-edit")).toBeVisible();
    await expect(doc.getByTestId("tab-versions")).toBeVisible();
    await expect(doc.getByTestId("document-controls")).toBeVisible();
    await expect(doc.getByTestId("document-state")).toContainText("Zapisano");
    await screenshot(page, testInfo, "collections-forms-edit");

    // Edycja pola przez Payloada (RenderFields) – działa z natywnym polem i z polem HeroUI agenta D.
    const summary = doc.locator('textarea[name="summary"], [data-path="summary"] textarea, #field-summary').first();
    const value = `Opis testowy ${Date.now()}`;
    await summary.fill(value);
    await expect(doc.getByTestId("document-state")).toContainText("Niezapisane zmiany");
    await doc.getByTestId("save-draft").click();
    await expect(doc.getByTestId("document-state")).toContainText("Zapisano", { timeout: 20_000 });
    await expect(doc.getByTestId("tab-versions")).toContainText(/Wersje \(\d+\)/);

    // Wersje
    await doc.getByTestId("tab-versions").click();
    await expect(page).toHaveURL(/\/versions$/);
    await expect(page.getByTestId("version-row").first()).toBeVisible();
    await screenshot(page, testInfo, "collections-forms-versions");
    await page.getByTestId("version-row").first().click();
    await expect(page.getByTestId("version-view")).toBeVisible();
    await expect(page.getByTestId("version-diff")).toContainText(value);
    await screenshot(page, testInfo, "collections-forms-version-diff");

    // API
    await page.getByTestId("tab-api").click();
    await expect(page.getByTestId("api-view")).toContainText(`"id": ${form.id}`);
  });

  test("strażnik niezapisanych zmian pyta przed wyjściem", async ({ page }) => {
    const list = await page.request.get(`${API}/statute-chunks?limit=1`);
    const chunk = (await list.json()).docs[0];
    await page.goto(`/official/collections/statute-chunks/${chunk.id}`);
    const doc = page.getByTestId("document-statute-chunks");
    await doc.locator('[data-path="unit"] input, #field-unit').first().fill(`${chunk.unit} (zmiana)`);
    await expect(doc.getByTestId("document-state")).toContainText("Niezapisane zmiany");
    // Okruszki są w pasku panelu (step-nav), poza widokiem dokumentu – strażnik działa na całej stronie.
    await page.locator(".step-nav").getByRole("link", { name: "Podstawy prawne" }).click();
    await expect(page.getByTestId("confirm-dialog")).toContainText("Opuścić bez zapisywania?");
    await page.getByTestId("confirm-dialog").getByRole("button", { name: "Anuluj" }).click();
    await expect(page).toHaveURL(new RegExp(`/statute-chunks/${chunk.id}$`));
  });

  test("nowy dokument: utworzenie i przekierowanie do edycji", async ({ page }, testInfo) => {
    await page.goto("/official/collections/statute-chunks");
    await page.getByTestId("list-create").click();
    await expect(page).toHaveURL(/statute-chunks\/create/);
    const doc = page.getByTestId("document-statute-chunks");
    await expect(doc.getByTestId("document-title")).toContainText("Nowy");
    await screenshot(page, testInfo, "collections-create");
    const id = `e2e-new-${Date.now()}`;
    await doc.locator('[data-path="chunkId"] input, #field-chunkId').first().fill(id);
    await doc.locator('[data-path="act"] input, #field-act').first().fill("Ustawa e2e-new");
    await doc.locator('[data-path="unit"] input, #field-unit').first().fill("art. 1");
    await doc.locator('[data-path="text"] textarea, #field-text').first().fill("Treść.");
    await doc.getByTestId("save").click();
    await expect(page).toHaveURL(/statute-chunks\/\d+$/);
    await expect(page.getByTestId("document-title")).toContainText("art. 1");

    // Usunięcie z menu „Więcej” (na ekranie dotykowym React Aria otwiera menu dotknięciem)
    const more = page.getByTestId("document-more");
    if (testInfo.project.name === "mobile") await more.tap();
    else await more.click();
    await page.getByRole("menuitem", { name: "Usuń" }).click();
    await page.getByTestId("confirm-dialog").getByRole("button", { name: "Usuń" }).click();
    await expect(page).toHaveURL(/statute-chunks(\?|$)/);
  });

  test("pliki: siatka miniatur i przełączanie na tabelę", async ({ page }, testInfo) => {
    await page.goto("/official/collections/media");
    const view = page.getByTestId("list-media");
    await expect(view.getByRole("heading", { level: 1, name: "Pliki" })).toBeVisible();
    await view.getByTestId("mode-grid").click();
    const grid = view.getByTestId("media-grid");
    const empty = view.getByText(/Brak/);
    await expect(grid.or(empty).first()).toBeVisible();
    await screenshot(page, testInfo, "collections-media-grid");
    await view.getByTestId("mode-table").click();
    await expect(view.getByTestId("list-columns")).toBeVisible();
    await screenshot(page, testInfo, "collections-media-table");
    await page.goto("/official/collections/media/create");
    await expect(page.getByTestId("upload-panel")).toBeVisible();
    await screenshot(page, testInfo, "collections-media-create");
  });

  test("dziennik decyzji: oś czasu tylko do odczytu", async ({ page }, testInfo) => {
    await page.goto("/official/collections/audit-log");
    const view = page.getByTestId("list-audit-log");
    await expect(view.getByRole("heading", { level: 1, name: "Dziennik decyzji" })).toBeVisible();
    await expect(view.getByTestId("list-create")).toHaveCount(0);
    await expect(view.getByTestId("audit-timeline")).toBeVisible();
    await expect(view.getByTestId("audit-timeline").locator("li").first()).toBeVisible();
    await screenshot(page, testInfo, "collections-audit-timeline");
    await view.getByTestId("mode-table").click();
    await expect(view.getByTestId("list-row").first()).toBeVisible();
    await expect(view.getByRole("checkbox")).toHaveCount(0);
    await screenshot(page, testInfo, "collections-audit-table");
  });

  test("wnioski i użytkownicy: listy z chipami", async ({ page }, testInfo) => {
    await page.goto("/official/collections/applications");
    await expect(page.getByTestId("list-applications").getByRole("heading", { level: 1, name: "Wnioski" })).toBeVisible();
    await screenshot(page, testInfo, "collections-applications-list");
    await page.goto("/official/collections/users");
    const users = page.getByTestId("list-users");
    await expect(users.getByText("Anna Nowak")).toBeVisible();
    await users.getByTestId("list-row").first().click();
    await expect(page.getByTestId("auth-panel")).toBeVisible();
    await screenshot(page, testInfo, "collections-users-edit");
  });

  test("global: preferencje w tej samej oprawie", async ({ page }, testInfo) => {
    await page.goto("/official/globals/settings");
    const doc = page.getByTestId("document-settings");
    await expect(doc.getByRole("heading", { level: 1, name: "Preferencje" })).toBeVisible();
    await expect(doc.getByTestId("document-controls")).toBeVisible();
    await screenshot(page, testInfo, "collections-global-settings");
    await page.goto("/official/globals/registry");
    await expect(page.getByTestId("document-registry").getByRole("heading", { level: 1, name: "Rejestry (demo)" })).toBeVisible();
    await screenshot(page, testInfo, "collections-global-registry");
  });

  test("opublikowany formularz ma podgląd dla obywatela", async ({ page }) => {
    const list = await page.request.get(`${API}/forms?where[status][equals]=published&limit=1`);
    const form = (await list.json()).docs[0];
    await page.goto(`/official/collections/forms/${form.id}`);
    await expect(page.getByTestId("preview-link")).toHaveAttribute("href", `/citizen/form/${form.id}`);
  });
});
