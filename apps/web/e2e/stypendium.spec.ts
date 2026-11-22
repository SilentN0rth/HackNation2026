/**
 * Wniosek łączący stypendium, nagrodę i wyróżnienie (referencja nr 9) wgrany jako arkusz ODS: pola wyboru
 * z kwadracikami, nagłówki grup jako tekst, pola klubu widoczne tylko dla wnioskodawcy „Klub sportowy”.
 * Sprawdzamy podgląd obywatela w edytorze – renderuje wszystkie strony z warunkami widoczności, bez walidacji.
 * Wymaga działającego silnika AI (FASTAPI_URL, domyślnie :8000) – bez niego test jest pomijany.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Locator } from "@playwright/test";
import { SEED_USER } from "./helpers";

const API = "/api/payload";
const FASTAPI_URL = (process.env.FASTAPI_URL ?? "http://localhost:8000").replace(/\/$/, "");

function sheet(): Buffer {
  const zip = path.resolve(
    import.meta.dirname,
    "../../../data-pdf/9. Wniosek o przyznanie stypendium, nagrody lub wyróżnienia sportowego Rady Miasta (Połączenie 3 wniosków w 1) - formularze do cyfryzacji (1).zip",
  );
  return execFileSync("unzip", ["-p", zip, "*.ods"], { maxBuffer: 50 * 1024 * 1024 });
}

async function aiAvailable(): Promise<boolean> {
  try {
    await fetch(FASTAPI_URL, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

const choose = (scope: Locator, option: string) => scope.getByRole("radio", { name: new RegExp(`^${option}\\*?$`) }).check({ force: true });
const textbox = (scope: Locator, label: string) => scope.getByRole("textbox", { name: new RegExp(`^${label}`) });

test("stypendium, nagroda, wyróżnienie z arkusza ODS: wybory, nagłówki i warunki", async ({ page }) => {
  test.skip(!(await aiAvailable()), "silnik AI (FastAPI) niedostępny");
  test.setTimeout(300_000);

  await page.goto("/official/login");
  await page.locator("#field-email").fill(SEED_USER.email);
  await page.locator("#field-password").fill(SEED_USER.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((u) => u.pathname.startsWith("/official") && !u.pathname.includes("login"));

  await page.goto("/official/upload");
  const created = page.waitForResponse((r) => r.url().includes(`${API}/forms?`) && r.request().method() === "POST", { timeout: 240_000 });
  await page.getByTestId("upload-input").setInputFiles({ name: "wniosek-o-przyznanie-stypendium.ods", mimeType: "application/vnd.oasis.opendocument.spreadsheet", buffer: sheet() });
  const doc = (await (await created).json()).doc as { id: number; source?: number };

  try {
    await expect(page).toHaveURL(new RegExp(`/official/forms/${doc.id}/editor$`), { timeout: 120_000 });
    const preview = page.getByTestId("citizen-preview");
    await expect(preview).toBeVisible();

    // Stypendium: wybór wnioskodawcy z kwadracików w arkuszu.
    await choose(preview, "Stypendium sportowe");
    const applicant = preview.getByRole("radiogroup", { name: /^Wnioskodawca/ });
    await expect(applicant.getByRole("radio")).toHaveCount(2);
    await expect(applicant.getByRole("radio", { name: /^Prezydent Miasta Zgierza/ })).toBeAttached();

    // Pola klubu pojawiają się dopiero po wyborze „Klub sportowy”.
    await expect(textbox(preview, "Nazwa klubu sportowego")).toHaveCount(0);
    await choose(applicant, "Klub sportowy");
    await expect(textbox(preview, "Nazwa klubu sportowego")).toBeVisible();
    for (const heading of ["Dane reprezentanta klubu sportowego", "Dane pełnomocnika klubu sportowego", "Dane klubu sportowego"]) {
      await expect(preview.getByRole("heading", { name: new RegExp(`^${heading}`) }), heading).toBeVisible();
      await expect(textbox(preview, heading), `${heading} nie jest polem do wpisania`).toHaveCount(0);
    }
    await expect(preview.getByRole("radiogroup", { name: /^Korespondencja z urzędem/ })).toBeVisible();
    await choose(applicant, "Prezydent Miasta Zgierza");
    await expect(textbox(preview, "Nazwa klubu sportowego")).toHaveCount(0);

    // Dane sportowca i osiągnięcia: lista dyscyplin raz, „Inna dyscyplina” jako tekst, załączniki jako pliki.
    await expect(preview.getByText(/^Dyscypliny sportowe\*?$/)).toHaveCount(1);
    await expect(textbox(preview, "Inna dyscyplina")).toBeVisible();
    await expect(preview.getByLabel(/^Wymagane zaświadczenia/)).toHaveAttribute("type", "file");
    await expect(preview.getByLabel(/^Dyplomy lub inne dokumenty/)).toHaveAttribute("type", "file");
    await expect(preview.getByRole("heading", { name: /^Opinia macierzystego klubu sportowego$/ })).toBeVisible();
    await expect(textbox(preview, "Rodzic/opiekun prawny")).toBeVisible();

    // Wyróżnienie: czterech podopiecznych trenera i zaświadczenia dla nich.
    await choose(preview, "Wyróżnienie sportowe");
    await expect(textbox(preview, "Inna dyscyplina")).toHaveCount(0);
    await expect(textbox(preview, "Imię i nazwisko zawodniczki/zawodnika")).toHaveCount(4);
    await expect(preview.getByLabel(/^Wymagane zaświadczenia wymienionych podopiecznych/)).toHaveAttribute("type", "file");
  } finally {
    await page.request.delete(`${API}/forms/${doc.id}`);
    if (doc.source) await page.request.delete(`${API}/media/${doc.source}`);
  }
});
