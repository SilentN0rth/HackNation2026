import { expect, test, waitForApp } from "./fixtures";

test("obywatel: zgoda → prefill → walidacja → podsumowanie → UPO", async ({ page, errors }) => {
  await page.goto("/citizen");
  await waitForApp(page);
  await page.getByRole("link", { name: /Rozpocznij: Zgłoszenie odbioru/ }).click();
  await waitForApp(page);

  await page.getByRole("button", { name: "Tak, uzupełnij" }).click();
  await expect(page.getByLabel("Imię i nazwisko")).toHaveValue("Jan Kowalski");
  await expect(page.getByText(/uzupełnione z/).first()).toBeVisible();

  await page.getByRole("button", { name: "Dalej" }).click();
  // krok 2 – puste wymagane pola → komunikaty
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Co mamy odebrać?");
  await page.getByRole("button", { name: "Dalej" }).click();
  await expect(page.getByText("Popraw zaznaczone pola, aby przejść dalej.")).toBeVisible();

  // wybór z listy (HeroUI Select) + tekst + data
  // pole warunkowe: „Opisz, co to jest” pojawia się dopiero po wyborze „Inne”
  await expect(page.getByLabel("Opisz, co to jest")).toHaveCount(0);
  await page.getByRole("button", { name: /Rodzaj odpadów/ }).click();
  await page.getByRole("option", { name: "Inne" }).click();
  await page.getByLabel("Opisz, co to jest").fill("Stara szafa i dwa krzesła");
  await page.getByLabel("Preferowana data odbioru").fill("2026-12-01");
  await page.getByRole("button", { name: "Dalej" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText("Sprawdź dane przed wysłaniem");
  await expect(page.getByText("Stara szafa i dwa krzesła")).toBeVisible();
  await page.getByRole("button", { name: "Podpisz i wyślij" }).click();
  await expect(page.getByText(/UPO\/2026/)).toBeVisible();

  await page.getByRole("link", { name: "Przejdź do Twoich spraw" }).click();
  await waitForApp(page);
  await expect(page.getByText("Wysłany").first()).toBeVisible();
  void errors;
});

test("obywatel: dokończenie szkicu z listy spraw", async ({ page, errors }) => {
  await page.goto("/citizen/applications");
  await waitForApp(page);
  const resume = page.getByRole("link", { name: /Dokończ/ }).first();
  if (await resume.count()) {
    await resume.click();
    await waitForApp(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  void errors;
});
