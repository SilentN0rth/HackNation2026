/**
 * Scenariusze z dokumentu „Wniosek o ustalenie numeru porządkowego nieruchomości – wizualizacja formularza
 * po cyfryzacji”: blankiet PDF przechodzi cały potok (FastAPI → Payload → publikacja), a potem obywatel
 * sprawdza, które pola pokazują się po wyborze podmiotu wniosku.
 * Wymaga działającego silnika AI (FASTAPI_URL, domyślnie :8000) – bez niego testy są pomijane.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { SEED_USER } from "./helpers";

const API = "/api/payload";
const FASTAPI_URL = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");

const WHO = "Wybierz, w czyim imieniu wnioskujesz";
const AS_WHO = "Wybierz, jako kto wnioskujesz";
const STAMP_Q = "Czy złożenie pełnomocnictwa wymaga opłaty skarbowej?";
const TRANSFER = "Plik z potwierdzeniem przelewu";
const POA_FILE = "Plik dokumentu z pełnomocnictwem";
const REP_FILE = "Plik z odpisem danych";

function blankPdf(): Buffer {
  const zip = path.resolve(
    import.meta.dirname,
    "../../../data-pdf/1. Wniosek o ustalenie numeru porządkowego nieruchomości - materiał referencyjny dla Uczestników do zadania (1).zip",
  );
  return execFileSync("unzip", ["-p", zip, "*.pdf"], { maxBuffer: 50 * 1024 * 1024 });
}

async function aiAvailable(): Promise<boolean> {
  try {
    await fetch(FASTAPI_URL, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

async function loginOfficial(page: Page) {
  await page.goto("/official/login");
  await page.locator("#field-email").fill(SEED_USER.email);
  await page.locator("#field-password").fill(SEED_USER.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => u.pathname.startsWith("/official") && !u.pathname.includes("login"));
}

/** Pole formularza obywatela po etykiecie (grupa radio albo pole tekstowe/plikowe). */
const exact = (text: string) => new RegExp(`^\\s*${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(?:\\*|\\(nieobowiązkowe\\))?\\s*$`);
const label = (page: Page, text: string) => page.getByText(exact(text));
const choose = (page: Page, option: string) => page.getByRole("radio", { name: exact(option) }).check({ force: true });

// Testy współdzielą formularz z pierwszego testu; kolejność zapewnia workers: 1, a nieudany test nie pomija reszty.
test.describe.configure({ mode: "default" });

test.describe("numer porządkowy – stany dynamiczne formularza", () => {
  let formId: number;
  let mediaId: number | undefined;

  test.beforeEach(async ({}, testInfo) => {
    test.skip(!(await aiAvailable()), "silnik AI (FastAPI) niedostępny");
    void testInfo;
  });

  test("przygotowanie: blankiet PDF → e-formularz → publikacja", async ({ page }) => {
    test.setTimeout(420_000);
    await loginOfficial(page);

    await page.goto("/official/upload");
    const created = page.waitForResponse((r) => r.url().includes(`${API}/forms?`) && r.request().method() === "POST", { timeout: 240_000 });
    await page.getByTestId("upload-input").setInputFiles({ name: "numer-porzadkowy.pdf", mimeType: "application/pdf", buffer: blankPdf() });
    const doc = (await (await created).json()).doc as { id: number; source?: number };
    formId = doc.id;
    mediaId = doc.source;

    await expect(page).toHaveURL(new RegExp(`/official/forms/${formId}/editor$`), { timeout: 120_000 });
    await expect(page.getByTestId("lint-panel")).toBeVisible();

    // Krytyczne uwagi trzeba obsłużyć, żeby można było opublikować.
    const publish = page.getByRole("button", { name: "Zatwierdź i opublikuj" });
    const critical = page.getByTestId("flag-card").filter({ hasText: "Krytyczna" }).filter({ has: page.getByRole("button", { name: "Poprawione" }) });
    for (let left = await critical.count(); left > 0; left--) {
      await critical.first().getByRole("button", { name: "Poprawione" }).click();
      await expect(critical).toHaveCount(left - 1);
    }
    await expect(publish).toBeEnabled();
    await page.waitForTimeout(800);
    await publish.click();
    await expect(page.getByTestId("editor-notice")).toContainText("Opublikowano");
  });

  test.describe("widok obywatela", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/citizen/form/${formId}`);
      // Przy wznowionym szkicu zgoda nie jest pytana ponownie.
      await page.getByRole("button", { name: "Wpiszę dane samodzielnie" }).click({ timeout: 10_000 }).catch(() => undefined);
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Dane");
    });

    test("wiersz 1: „Swoim” – tylko dane wnioskodawcy, bez sekcji dodatkowych", async ({ page }) => {
      await choose(page, "Swoim");
      await expect(label(page, "Nazwisko").first()).toBeVisible();
      await expect(label(page, "Nazwisko")).toHaveCount(1);
      for (const hidden of [AS_WHO, STAMP_Q, POA_FILE, REP_FILE, "NIP", "REGON", "Numer KRS"]) {
        await expect(label(page, hidden), hidden).toHaveCount(0);
      }
    });

    test("wiersz 2: „Innej osoby” – dane i adres innej osoby, pełnomocnictwo, opłata skarbowa", async ({ page }) => {
      await choose(page, "Innej osoby");
      await expect(label(page, "Nazwisko")).toHaveCount(2); // wnioskodawca + inna osoba
      await expect(label(page, "Numer PESEL")).toHaveCount(2);
      await expect(label(page, POA_FILE)).toBeVisible();
      await expect(label(page, STAMP_Q)).toBeVisible();
      for (const hidden of [AS_WHO, "NIP", REP_FILE]) await expect(label(page, hidden), hidden).toHaveCount(0);
    });

    test("wiersz 2: opłata skarbowa NIE – brak pola na potwierdzenie przelewu, TAK – pole pojawia się", async ({ page }) => {
      await choose(page, "Innej osoby");
      await choose(page, "Nie");
      await expect(label(page, TRANSFER), "przy „Nie” nie ma pola z plikiem").toHaveCount(0);
      await choose(page, "Tak");
      await expect(label(page, TRANSFER)).toHaveCount(1);
    });

    test("wiersz 3: „Osoby prawnej…” – radio „jako kto wnioskujesz”, dane podmiotu i adres siedziby", async ({ page }) => {
      await choose(page, "Osoby prawnej lub jednostki organizacyjnej");
      await expect(label(page, AS_WHO)).toBeVisible();
      for (const shown of ["Nazwa", "NIP", "REGON", "Numer KRS"]) await expect(label(page, shown), shown).toBeVisible();
      // Dopóki nie wybrano roli, nie ma plików pełnomocnika ani reprezentanta.
      for (const hidden of [POA_FILE, REP_FILE, TRANSFER, STAMP_Q]) await expect(label(page, hidden), hidden).toHaveCount(0);
    });

    test("wiersz 4: osoba prawna jako Pełnomocnik – pełnomocnictwo i opłata skarbowa za pełnomocnictwo", async ({ page }) => {
      await choose(page, "Osoby prawnej lub jednostki organizacyjnej");
      await choose(page, "Pełnomocnik");
      await expect(label(page, POA_FILE)).toBeVisible();
      await expect(label(page, TRANSFER)).toHaveCount(1);
      await expect(label(page, REP_FILE)).toHaveCount(0);
    });

    test("wiersz 5: osoba prawna jako Reprezentant – potwierdzenie, że jesteś reprezentantem", async ({ page }) => {
      await choose(page, "Osoby prawnej lub jednostki organizacyjnej");
      await choose(page, "Reprezentant");
      await expect(label(page, REP_FILE)).toBeVisible();
      for (const hidden of [POA_FILE, TRANSFER]) await expect(label(page, hidden), hidden).toHaveCount(0);
    });

    test("zmiana odpowiedzi chowa sekcje poprzedniego wyboru", async ({ page }) => {
      await choose(page, "Osoby prawnej lub jednostki organizacyjnej");
      await choose(page, "Pełnomocnik");
      await expect(label(page, POA_FILE)).toBeVisible();
      await choose(page, "Swoim");
      for (const hidden of [AS_WHO, POA_FILE, TRANSFER, "NIP"]) await expect(label(page, hidden), hidden).toHaveCount(0);
    });

    test("wiersz 3 i 4 dokumentu: radio „jako kto wnioskujesz” stoi po radiu „w czyim imieniu”", async ({ page }) => {
      await choose(page, "Osoby prawnej lub jednostki organizacyjnej");
      const who = await label(page, WHO).boundingBox();
      const asWho = await label(page, AS_WHO).boundingBox();
      expect(who && asWho && asWho.y > who.y, "kolejność pól na stronie").toBeTruthy();
    });

    test("strony 2 i 3: Lokalizacja budynku i Dane do kontaktu", async ({ page }) => {
      await expect(page.getByRole("navigation", { name: "Postęp wypełniania" })).toContainText(/Szczegóły wniosku/);
      await expect(page.getByRole("navigation", { name: "Postęp wypełniania" })).toContainText(/Kontakt/);
    });
  });

  test("sprzątanie: usunięcie formularza testowego", async ({ page }) => {
    if (!formId) return;
    await loginOfficial(page);
    await page.request.delete(`${API}/forms/${formId}`);
    if (mediaId) await page.request.delete(`${API}/media/${mediaId}`);
  });
});
