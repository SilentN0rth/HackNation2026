import path from "node:path";
import { expect, test, waitForApp } from "./fixtures";

test("edytor: struktura, zakładki, rozstrzygnięcie flagi", async ({ page, errors }) => {
  await page.goto("/official/drafts/draft-dodatek-mieszkaniowy");
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Wniosek o przyznanie dodatku mieszkaniowego");

  // wybór pola w strukturze → edytor pola
  const tree = page.getByRole("navigation", { name: "Struktura formularza" });
  await tree.getByRole("button").first().click();
  await expect(page.getByLabel("Etykieta (pytanie)")).toBeVisible();
  await page.getByLabel("Etykieta (pytanie)").fill("Imię (zmienione)");
  await expect(page.getByRole("button", { name: "Zapisz i sprawdź ponownie" })).toBeEnabled();

  // podgląd i JSON
  await page.getByRole("tab", { name: "Podgląd dla obywatela" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Twoje dane");
  await page.getByRole("tab", { name: "JSON" }).click();
  await expect(page.locator("pre")).toContainText('"title"');

  // flaga: odrzucenie z uzasadnieniem (walidacja Zod: min. 10 znaków)
  const panel = page.getByRole("complementary", { name: "Panel lintera" });
  await panel.getByRole("button", { name: "Odrzuć z uzasadnieniem" }).first().click();
  await panel.getByRole("button", { name: "Zapisz" }).click();
  await expect(panel.getByText(/min\. 10 znaków/)).toBeVisible();
  await panel.getByRole("textbox").fill("Pole wymagane lokalnym regulaminem gminy.");
  await panel.getByRole("button", { name: "Zapisz" }).click();
  await expect(panel.getByText(/Odrzucone przez/).first()).toBeVisible();

  // zapis i ponowny lint
  await page.getByRole("button", { name: "Zapisz i sprawdź ponownie" }).click();
  await expect(page.getByRole("button", { name: "Zapisano" })).toBeVisible();
  void errors;
});

test("upload: zły plik → komunikat, dobry plik → edytor", async ({ page, errors }) => {
  await page.goto("/official/upload");
  await waitForApp(page);
  const input = page.locator('input[type="file"]');

  await input.setInputFiles({ name: "wniosek.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
  await expect(page.getByRole("alert").filter({ hasText: "Nieobsługiwany format" })).toBeVisible();

  await input.setInputFiles({ name: "wniosek.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  await expect(page.getByRole("progressbar")).toBeVisible();
  await page.waitForURL(/\/official\/drafts\/draft-/, { timeout: 15_000 });
  await waitForApp(page);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  void errors;
  void path;
});

test("audit trail pokazuje wpisy", async ({ page, errors }) => {
  await page.goto("/official/audit");
  await waitForApp(page);
  await expect(page.getByRole("grid").or(page.getByRole("table"))).toBeVisible();
  void errors;
});
