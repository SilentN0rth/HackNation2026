/** Stany dynamiczne wniosku o stwierdzenie nadpłaty podatku (formularz 5) w widoku obywatela, wg wizualizacji organizatora. */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { SEED_USER } from "./helpers";

const API = "/api/payload";
const FASTAPI_URL = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");

async function aiAvailable(): Promise<boolean> {
  try {
    await fetch(FASTAPI_URL, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/** PDF z paczki konkursowej (data-pdf/5.*.zip) – rozpakowany w locie. */
function samplePdf(): Buffer {
  const zip = path.resolve(
    import.meta.dirname,
    "../../../data-pdf/5. Wniosek o stwierdzenie nadpłaty podatku - materiał referencyjny dla Uczestników do zadania.zip",
  );
  return execFileSync("unzip", ["-p", zip, "*.PDF"], { maxBuffer: 20 * 1024 * 1024 });
}

/** Opublikowany formularz wygenerowany przez silnik AI z pliku źródłowego; po teście jest usuwany. */
async function publishFromSource(request: APIRequestContext) {
  const login = await request.post(`${API}/users/login`, { data: { email: SEED_USER.email, password: SEED_USER.password } });
  expect(login.ok()).toBeTruthy();
  const media = await request.post(`${API}/media`, {
    multipart: { file: { name: "nadplata.pdf", mimeType: "application/pdf", buffer: samplePdf() }, _payload: JSON.stringify({ alt: "nadplata" }) },
  });
  expect(media.ok(), await media.text()).toBeTruthy();
  const mediaId = (await media.json()).doc.id as number;
  const created = await request.post(`${API}/forms`, { data: { title: "E2E nadpłata", source: mediaId, status: "draft" } });
  expect(created.ok(), await created.text()).toBeTruthy();
  const form = (await created.json()).doc as { id: number; aiStatus: string };
  expect(form.aiStatus).toBe("ready");
  const published = await request.patch(`${API}/forms/${form.id}`, { data: { status: "published" } });
  expect(published.ok(), await published.text()).toBeTruthy();
  return { formId: form.id, mediaId };
}

const choose = (page: Page, label: string) => page.getByText(label, { exact: true }).first().click();
const shown = (page: Page, label: string) => expect(page.getByText(label, { exact: true })).toBeVisible();
const hidden = (page: Page, label: string) => expect(page.getByText(label, { exact: true })).toHaveCount(0);

test.describe("wniosek o stwierdzenie nadpłaty – stany dynamiczne", () => {
  let formId = 0;
  let mediaId = 0;

  test.beforeAll(async ({ playwright }) => {
    test.skip(!(await aiAvailable()), "silnik AI (FastAPI) niedostępny");
    const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 5173}` });
    ({ formId, mediaId } = await publishFromSource(request));
    await request.dispose();
  });

  test.afterAll(async ({ playwright }) => {
    if (!formId) return;
    const request = await playwright.request.newContext({ baseURL: process.env.E2E_BASE_URL ?? `http://localhost:${process.env.E2E_PORT ?? 5173}` });
    await request.post(`${API}/users/login`, { data: { email: SEED_USER.email, password: SEED_USER.password } });
    await request.delete(`${API}/forms/${formId}`);
    await request.delete(`${API}/media/${mediaId}`);
    await request.dispose();
  });

  test("strona 1: sekcje zależne od podmiotu wniosku i opłaty skarbowej", async ({ page }) => {
    await page.goto(`/citizen/form/${formId}`);
    await page.getByRole("button", { name: "Wpiszę dane samodzielnie" }).click();

    await choose(page, "Swoim");
    await hidden(page, "Plik dokumentu z pełnomocnictwem");
    await hidden(page, "Wybierz, jako kto wnioskujesz");

    await choose(page, "Innej osoby");
    await shown(page, "Plik dokumentu z pełnomocnictwem");
    await shown(page, "Czy złożenie pełnomocnictwa wymaga opłaty skarbowej?");
    await hidden(page, "Plik z potwierdzeniem przelewu");
    await choose(page, "Nie");
    await hidden(page, "Plik z potwierdzeniem przelewu");
    await choose(page, "Tak");
    await shown(page, "Plik z potwierdzeniem przelewu");

    await choose(page, "Osoby prawnej lub jednostki organizacyjnej");
    await shown(page, "Wybierz, jako kto wnioskujesz");
    await shown(page, "NIP");
    await hidden(page, "Czy złożenie pełnomocnictwa wymaga opłaty skarbowej?");

    await choose(page, "Pełnomocnik");
    await shown(page, "Plik dokumentu z pełnomocnictwem");
    await shown(page, "Plik z potwierdzeniem przelewu");
    await hidden(page, "Plik z odpisem danych");

    await choose(page, "Reprezentant");
    await shown(page, "Plik z odpisem danych");
    await hidden(page, "Plik dokumentu z pełnomocnictwem");
  });
});
