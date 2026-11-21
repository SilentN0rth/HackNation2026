/** Widoki domenowe panelu (agent E): pulpit, nowy z pliku, edytor formularza, dziennik decyzji. */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { login, screenshot, SEED_USER, trackConsoleErrors } from "./helpers";

const API = "/api/payload";
const FASTAPI_URL = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");
// Odpowiedzi 4xx/5xx z REST (np. silnik AI wyłączony) przeglądarka loguje jako błąd zasobu – to oczekiwane.
const EXPECTED_HTTP_ERRORS = [/Failed to load resource/];

type Flag = { id: string; severity: string; resolution?: { action: string; justification?: string } };
type Form = { id: number; title: string; status: string; lintFlags?: Flag[] | null; schema?: unknown };

const handled = (f: Flag) => Boolean(f.resolution) && (f.resolution!.action !== "rejected" || Boolean(f.resolution!.justification?.trim()));

async function forms(request: APIRequestContext): Promise<Form[]> {
  const res = await request.get(`${API}/forms`, { params: { draft: "true", depth: "0", limit: "500" } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()).docs;
}

async function aiAvailable(): Promise<boolean> {
  try {
    await fetch(FASTAPI_URL, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/** PDF z paczki konkursowej (data-pdf/*.zip) – rozpakowany w locie. */
function samplePdf(): Buffer {
  const zip = path.resolve(import.meta.dirname, "../../../data-pdf/2. Wniosek o zwrot opłaty skarbowej - formularze do cyfryzacji.zip");
  return execFileSync("unzip", ["-p", zip, "*.pdf"], { maxBuffer: 20 * 1024 * 1024 });
}

/** Świeży formularz do edycji (kopia schematu z seeda) – testy nie zmieniają danych demo. */
async function createTestForm(request: APIRequestContext, title: string): Promise<Form> {
  const all = await forms(request);
  const base = all.find((f) => f.title === "Wniosek o przyznanie dodatku mieszkaniowego");
  expect(base, "formularz z seeda").toBeTruthy();
  const res = await request.post(`${API}/forms`, {
    params: { draft: "true", depth: "0" },
    data: {
      title,
      status: "in_review",
      schema: { ...(base!.schema as object), id: `e2e-${Date.now()}`, title },
      lintFlags: (base!.lintFlags ?? []).map((f) => ({ ...f, resolution: undefined })),
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()).doc;
}

async function openEditor(page: Page, id: number) {
  await page.goto(`/official/forms/${id}/editor`);
  await expect(page.getByTestId("panel-editor")).toBeVisible();
}

test.describe("widoki panelu", () => {
  let errors: string[];
  const cleanup: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = trackConsoleErrors(page, EXPECTED_HTTP_ERRORS);
    await login(page);
  });

  test.afterEach(async ({ page }) => {
    for (const url of cleanup.splice(0)) await page.request.delete(url);
    expect(errors, "błędy w konsoli przeglądarki").toEqual([]);
  });

  test("pulpit pokazuje statystyki zgodne z danymi Payloada", async ({ page }, testInfo) => {
    const all = await forms(page.request);
    const apps = await (await page.request.get(`${API}/applications`, { params: { limit: "1" } })).json();
    const audit = await (await page.request.get(`${API}/audit-log`, { params: { limit: "1" } })).json();
    const expected: Record<string, number> = {
      draft: all.filter((f) => f.status === "draft").length,
      "in-review": all.filter((f) => f.status === "in_review").length,
      published: all.filter((f) => f.status === "published").length,
      critical: all.reduce((n, f) => n + (f.lintFlags ?? []).filter((x) => x.severity === "error" && !handled(x)).length, 0),
      applications: apps.totalDocs,
      audit: audit.totalDocs,
    };

    const dashboard = page.getByTestId("panel-dashboard");
    await expect(dashboard.getByRole("heading", { level: 1 })).toContainText("Anna");
    for (const [key, value] of Object.entries(expected)) {
      const stat = page.getByTestId(`stat-${key}`);
      await expect(stat.locator("[data-value]")).toHaveAttribute("data-value", String(value));
      // Licznik dolicza do wartości.
      await expect(stat.locator("dd").first()).toContainText(String(value));
    }
    await expect(dashboard.getByRole("link", { name: /Wniosek o przyznanie dodatku mieszkaniowego/ }).first()).toBeVisible();
    await expect(page.getByTestId("recent-audit").locator("li").first()).toBeVisible();
    await screenshot(page, testInfo, "views-dashboard");

    await dashboard.getByRole("link", { name: "Nowy z pliku" }).first().click();
    await expect(page).toHaveURL(/\/official\/upload$/);
  });

  test("nowy z pliku: wgranie PDF, kroki i obsługa silnika AI", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const ai = await aiAvailable();
    await page.goto("/official/upload");
    await expect(page.getByTestId("panel-upload")).toBeVisible();
    await expect(page.getByTestId("pipeline").locator("li")).toHaveCount(5);
    await screenshot(page, testInfo, "views-upload");

    const created = page.waitForResponse((r) => r.url().includes(`${API}/forms?`) && r.request().method() === "POST", { timeout: 240_000 });
    await page.getByTestId("upload-input").setInputFiles({ name: "wniosek-o-zwrot-oplaty.pdf", mimeType: "application/pdf", buffer: samplePdf() });
    await expect(page.getByTestId("pipeline").locator('li[data-state="active"]')).toHaveCount(1);
    const body = await (await created).json();
    const form = body.doc as Form & { source: number };
    cleanup.push(`${API}/forms/${form.id}`, `${API}/media/${form.source}`);

    if (ai && (form as { aiStatus?: string }).aiStatus === "ready") {
      await page.waitForURL(new RegExp(`/official/forms/${form.id}/editor$`), { timeout: 30_000 });
      await expect(page.getByTestId("lint-panel")).toBeVisible();
      await screenshot(page, testInfo, "views-upload-done");
      return;
    }

    // Silnik AI wyłączony: komunikat, ponowienie i przejście do formularza.
    const error = page.getByTestId("upload-error");
    await expect(error).toBeVisible();
    await expect(error).toContainText(/Silnik AI|FastAPI/);
    await screenshot(page, testInfo, "views-upload-error");
    const retry = page.waitForResponse((r) => r.url().includes(`/forms/${form.id}/generate`), { timeout: 240_000 });
    await error.getByRole("button", { name: "Spróbuj ponownie" }).click();
    await expect(page.getByTestId("pipeline").locator('li[data-state="active"]')).toHaveCount(1);
    const status = (await retry).status();
    if (status === 200) {
      await page.waitForURL(new RegExp(`/official/forms/${form.id}/editor$`));
      return;
    }
    await expect(page.getByTestId("upload-error")).toBeVisible();
    await page.getByTestId("upload-error").getByRole("button", { name: "Otwórz formularz" }).click();
    await page.waitForURL(new RegExp(`/official/forms/${form.id}/editor$`));
    await expect(page.getByRole("button", { name: "Spróbuj ponownie" })).toBeVisible();
  });

  test("edytor: edycja pola, zapis, kontrola jakości, uwagi i publikacja", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const title = `E2E edytor ${testInfo.project.name} ${Date.now()}`;
    const form = await createTestForm(page.request, title);
    cleanup.push(`${API}/forms/${form.id}`);
    await openEditor(page, form.id);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await expect(page.getByTestId("citizen-preview")).toBeVisible();
    await screenshot(page, testInfo, "views-editor");

    // Edycja pola i zapis wersji roboczej.
    const nav = page.getByRole("navigation", { name: "Struktura formularza" });
    await nav.getByRole("button", { name: "Imię", exact: true }).click();
    const label = page.getByTestId("field-label").getByRole("textbox");
    await label.fill("Imię wnioskodawcy");
    await expect(nav.getByRole("button", { name: "Imię wnioskodawcy" })).toBeVisible();
    await page.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(page.getByTestId("editor-notice")).toContainText("Zapisano");
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Struktura formularza" }).getByRole("button", { name: "Imię wnioskodawcy" })).toBeVisible();

    // Kontrola jakości przez FastAPI – formularz bez pliku źródłowego dostaje czytelny komunikat.
    await page.getByTestId("lint-panel").getByRole("button", { name: "Uruchom" }).click();
    await expect(page.getByTestId("editor-notice").or(page.getByTestId("editor-error"))).toBeVisible();

    // Obsłużenie krytycznych uwag odblokowuje publikację.
    const publish = page.getByRole("button", { name: "Zatwierdź i opublikuj" });
    await expect(publish).toBeDisabled();
    const critical = page.getByTestId("flag-card").filter({ hasText: "Krytyczna" }).filter({ has: page.getByRole("button", { name: "Poprawione" }) });
    for (let left = await critical.count(); left > 0; left--) {
      await critical.first().getByRole("button", { name: "Poprawione" }).click();
      await expect(critical).toHaveCount(left - 1);
    }
    await expect(publish).toBeEnabled();
    await page.waitForTimeout(800); // karty kończą animację przestawiania
    await screenshot(page, testInfo, "views-editor-resolved");
    await publish.click();
    await expect(page.getByTestId("editor-notice")).toContainText("Opublikowano");

    await page.goto("/citizen");
    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Wpisy w dzienniku dla tego formularza.
    await page.goto(`/official/audit?form=${form.id}`);
    const timeline = page.getByTestId("audit-timeline");
    await expect(timeline).toContainText("Opublikowano wersję 1");
    await expect(timeline).toContainText("Poprawiono:");
    await expect(timeline).toContainText("Zmieniono strukturę formularza");
  });

  test("dziennik decyzji: oś czasu i filtry", async ({ page }, testInfo) => {
    await page.goto("/official/audit");
    await expect(page).toHaveURL(/\/official\/audit$/);
    await expect(page.getByTestId("panel-audit")).toBeVisible();
    const entries = page.getByTestId("audit-entry");
    await expect(entries.first()).toBeVisible();
    const total = await entries.count();
    await screenshot(page, testInfo, "views-audit");

    await page.getByTestId("filter-action").getByRole("button").click();
    await page.getByRole("option", { name: "Wgranie pliku" }).click();
    // Wpisy innych akcji znikają (animacja wyjścia) – zostają tylko wgrania.
    await expect(entries.filter({ hasNotText: "Wgranie pliku" })).toHaveCount(0);
    const n = await entries.count();
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(total);
    await expect(page.getByTestId("audit-count")).toContainText(String(n));

    await page.getByRole("button", { name: "Wyczyść" }).click();
    await expect(entries).toHaveCount(total);
    // Link prowadzi do edytora formularza.
    await page.getByTestId("audit-timeline").getByRole("link").first().click();
    await expect(page).toHaveURL(/\/official\/forms\/\d+\/editor$/);
  });
  test("widok startowy z preferencji: po zalogowaniu formularze zamiast pulpitu", async ({ page }) => {
    const set = (defaultView: string) => page.request.post(`${API}/globals/settings`, { data: { defaultView } });
    expect((await set("forms")).ok()).toBeTruthy();
    try {
      await page.context().clearCookies();
      await page.goto("/official/login");
      await page.locator("#field-email").fill(SEED_USER.email);
      await page.locator("#field-password").fill(SEED_USER.password);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/official\/collections\/forms/);
      // Link „Pulpit” nadal otwiera pulpit.
      await page.goto("/official");
      await expect(page.getByTestId("panel-dashboard")).toBeVisible();
    } finally {
      expect((await set("dashboard")).ok()).toBeTruthy();
    }
  });
});
