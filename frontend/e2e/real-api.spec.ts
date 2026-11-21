import { expect, test, waitForApp } from "./fixtures";

/**
 * Scenariusz na PRAWDZIWYM backendzie (NEXT_PUBLIC_USE_MOCKS=false, API na :8000).
 * Uruchom: E2E_REAL=1 E2E_BASE_URL=http://localhost:3100 E2E_SAMPLE_PDF=<ścieżka do PDF> npx playwright test real-api
 */
test.skip(!process.env.E2E_REAL, "tylko z E2E_REAL=1 (wymaga backendu)");

test("plik PDF → SSE → edytor → JSON COI → publikacja → e-usługa obywatela", async ({ page, errors }) => {
  test.setTimeout(90_000);
  await page.goto("/official/upload");
  await waitForApp(page);
  await page.locator('input[type="file"]').setInputFiles(process.env.E2E_SAMPLE_PDF!);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.waitForURL(/\/official\/drafts\/draft-/, { timeout: 60_000 });
  await waitForApp(page);

  const title = (await page.getByRole("heading", { level: 1 }).textContent())!;
  const tree = page.getByRole("navigation", { name: "Struktura formularza" });
  await expect(tree.getByRole("heading", { name: "Dane" })).toBeVisible();

  await page.getByRole("tab", { name: "JSON" }).click();
  await expect(page.locator("pre")).toContainText('"flow"');

  await page.getByRole("button", { name: "Zatwierdź i opublikuj" }).click();
  await page.waitForURL(/\/official$/);
  await waitForApp(page);

  await page.goto("/citizen");
  await waitForApp(page);
  await page.getByRole("link", { name: `Rozpocznij: ${title}` }).first().click();
  await waitForApp(page);
  await page.getByRole("button", { name: "Tak, uzupełnij" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Dane");
  void errors;
});
