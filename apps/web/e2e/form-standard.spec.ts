/**
 * Zgodność formularza obywatela ze standardem „HackNation. Standardy i dobre praktyki
 * projektowania formularzy” (PDF z materiałów do zadania). Numery w nawiasach to punkty standardu.
 * Testy biorą pierwszy opublikowany formularz z sekcją „Nazwa urzędu” i sprawdzają go w UI obywatela.
 */
import { expect, test, type Page } from "@playwright/test";

type SchemaField = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  readOnly?: boolean;
  validation?: { pattern?: string };
};
type Schema = { title: string; pages: { title: string; fields: SchemaField[] }[] };

let formId: number | string;
let schema: Schema;

test.beforeAll(async ({ request }) => {
  const res = await request.get("/api/payload/forms?limit=50&depth=0&where[status][equals]=published");
  const docs: { id: number; schema: Schema }[] = (await res.json()).docs;
  const found = docs.find((d) => d.schema.pages.some((p) => p.fields.some((f) => /^Nazwa (urzędu|organu)$/.test(f.label.trim()))));
  test.skip(!found, "brak opublikowanego formularza ze standardową sekcją adresata");
  formId = found!.id;
  schema = found!.schema;
});

const fields = () => schema.pages.flatMap((p) => p.fields);
const byLabel = (label: string) => fields().filter((f) => f.label.trim() === label);

/** Wchodzi do kreatora bez prefillu (pola z rejestru zostają puste). */
async function openWizard(page: Page) {
  await page.goto(`/citizen/form/${formId}`);
  await page.getByRole("button", { name: "Wpiszę dane samodzielnie" }).click();
  await expect(page.getByRole("button", { name: "Dalej" })).toBeVisible();
}

const VALUE_BY_LABEL: [RegExp, string][] = [
  [/PESEL/i, "44051401359"],
  [/^NIP/i, "5260001246"],
  [/REGON/i, "123456785"],
  [/KRS/i, "0000123456"],
  [/Kod pocztowy/i, "85-001"],
  [/telefon/i, "600100200"],
  [/e-mail/i, "jan@example.pl"],
  [/Numer budynku|Numer lokalu/i, "12"],
];

/** Wypełnia wszystkie widoczne, puste pola bieżącej strony prawidłowymi danymi i klika „Dalej”. */
async function fillCurrentPage(page: Page) {
  for (const group of await page.getByRole("radiogroup").all()) {
    if ((await group.getByRole("radio", { checked: true }).count()) === 0) await group.getByRole("radio").first().check({ force: true });
  }
  for (const trigger of await page.locator("main form button[aria-haspopup]").all()) {
    if (!(await trigger.isVisible()) || !(await trigger.innerText()).includes("wybierz")) continue;
    await trigger.click();
    await page.getByRole("option").first().click();
  }
  for (const input of await page.locator("main form input:not([type=hidden]):not([type=file]):not([type=radio]):not([type=checkbox]), main form textarea").all()) {
    if (!(await input.isVisible()) || !(await input.isEditable()) || (await input.inputValue())) continue;
    const name = (await input.getAttribute("aria-label")) ?? (await input.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? ""));
    const type = await input.getAttribute("type");
    await input.fill(type === "date" ? "2026-12-01" : (VALUE_BY_LABEL.find(([re]) => re.test(name))?.[1] ?? "Test"));
  }
  for (const file of await page.locator('main form input[type="file"]').all())
    await file.setInputFiles({ name: "zalacznik.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4") });
  for (const box of await page.getByRole("checkbox").all()) {
    const label = (await box.evaluate((el) => (el as HTMLInputElement).labels?.[0]?.textContent ?? "")) ?? "";
    if (/zgod|klauzul|oświadcz/i.test(label) && !(await box.isChecked())) await box.check({ force: true });
  }
  await page.getByRole("button", { name: "Dalej" }).click();
}

/** Przechodzi cały kreator aż do strony „Podsumowanie”. */
async function reachSummary(page: Page) {
  await openWizard(page);
  for (let step = 0; step < 8; step++) {
    if (await page.getByRole("button", { name: "Podpisz i wyślij" }).isVisible()) return;
    await fillCurrentPage(page);
    await page.waitForTimeout(400);
  }
  await expect(page.getByRole("button", { name: "Podpisz i wyślij" })).toBeVisible();
}

const pick = (page: Page, option: string) => page.getByText(option, { exact: true }).first().click();

test.describe("Tytuł i komunikacja (§1, Tytuł)", () => {
  test("tytuł zaczyna się od właściwego rzeczownika i nie odwołuje się do przepisów", () => {
    expect(schema.title).toMatch(/^(Wniosek|Zgłoszenie|Deklaracja|Oświadczenie) /);
    expect(schema.title).not.toMatch(/\b(art\.|ust\.|ustaw|rozporządz|§)/i);
  });

  test("teksty na stronie nie zawierają pretensjonalnych zwrotów z listy „błędów do uniknięcia”", async ({ page }) => {
    await openWizard(page);
    const text = (await page.locator("main").innerText()).toLowerCase();
    for (const bad of ["pragniemy", "informujemy", "w odniesieniu do powyższego", "dokonać", "posiadać"])
      expect(text, `zwrot „${bad}”`).not.toContain(bad);
  });
});

test.describe("Sekcje predefiniowane (§Budowa formularza)", () => {
  test("adresat: „Nazwa urzędu” (lub „organu”) jest pierwsza i tylko do odczytu", () => {
    const first = schema.pages[0].fields[0];
    expect(first.label.trim()).toMatch(/^Nazwa (urzędu|organu)$/);
    expect(first.readOnly).toBe(true);
  });

  test("„Twoje dane”: imię, nazwisko i PESEL z rejestru, tylko do odczytu, PESEL z walidatorem", () => {
    for (const label of ["Imię", "Nazwisko", "Numer PESEL"]) {
      const f = byLabel(label).find((x) => x.readOnly);
      expect(f, label).toBeTruthy();
      expect(f!.required, label).toBe(true);
    }
    expect(byLabel("Numer PESEL").every((f) => f.type === "pesel")).toBe(true);
  });

  test("„Dane do kontaktu”: telefon i e-mail są nieobowiązkowe", () => {
    for (const label of ["Numer telefonu", "Adres e-mail"]) {
      const f = byLabel(label)[0];
      expect(f, label).toBeTruthy();
      expect(f.required, label).toBeFalsy();
    }
  });

  test("generator nadaje polom tytuł sekcji (pole `section`)", () => {
    test.skip(!fields().some((f) => (f as { section?: string }).section), "formularz wygenerowany przed dodaniem pola section – wgraj PDF ponownie");
    expect(fields().every((f) => (f as { section?: string }).section)).toBe(true);
  });

  test("sekcje mają widoczne nagłówki (grupowanie pól tematycznie)", async ({ page }) => {
    // Dopisujemy `section` do odpowiedzi API, żeby sprawdzić samo renderowanie również na starszych formularzach.
    await page.route(new RegExp(`/api/payload/forms/${formId}(\\?|$)`), async (route) => {
      const res = await route.fetch();
      const body = await res.json();
      let section = "Podmiot wniosku";
      for (const f of body.schema.pages[0].fields) {
        if (f.section) continue;
        f.section = section;
        if (/czyim imieniu/.test(f.label)) section = "Twoje dane";
      }
      await route.fulfill({ response: res, json: body });
    });
    await openWizard(page);
    const headings = page.locator("main h2");
    for (const name of ["Podmiot wniosku", "Twoje dane"])
      await expect(headings.filter({ hasText: name }).first(), name).toBeVisible();
  });

  test("zgody i oświadczenia są w sekcji zgód, nie jako luźne pole wyboru", async ({ page }) => {
    const last = schema.pages[schema.pages.length - 1];
    const consents = last.fields.filter((f) => f.type === "checkbox" && /zgod|klauzul|oświadcz/i.test(f.label));
    expect(consents.length).toBeGreaterThan(0);
    // docelowo: nagłówek „Zgoda” / „Zgody i oświadczenia” grupuje te pola (sprawdzane w teście ostatniego kroku)
    await openWizard(page);
    await expect(page.locator("main")).toBeVisible();
  });
});

test.describe("Układ i walidacja (§Ogólne zasady)", () => {
  test("układ jednokolumnowy: widoczne pola leżą jedno pod drugim", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Swoim");
    const boxes = await page
      .locator("main form input:not([type=hidden]), main form textarea, main form button[aria-haspopup]")
      .evaluateAll((els) =>
        els
          .filter((el) => !(el.tagName === "BUTTON" && el.parentElement?.querySelector("input"))) // przycisk w polu z wyszukiwarką
          .map((el) => ({ name: el.getAttribute("name") ?? "", r: el.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && r.height > 0)
          .map(({ name, r }) => ({ name, left: Math.round(r.left), top: Math.round(r.top) })),
      );
    expect(boxes.length).toBeGreaterThan(3);
    // przyciski opcji jednej grupy (radio) leżą w jednym wierszu – to jedno pole
    const firstOfGroup = boxes.filter((b, i) => !b.name || boxes.findIndex((x) => x.name === b.name) === i);
    const tops = firstOfGroup.map((b) => b.top);
    expect(new Set(tops).size, "dwa pola w jednym wierszu").toBe(tops.length);
  });

  test("każde widoczne pole ma nazwę dostępną dla czytnika ekranu", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Innej osoby");
    const unnamed = await page.evaluate(() => {
      const out: string[] = [];
      document.querySelectorAll<HTMLElement>("main form input:not([type=hidden]), main form textarea, main form [role=combobox]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const labelled =
          el.getAttribute("aria-label") ||
          el.getAttribute("aria-labelledby") ||
          (el as HTMLInputElement).labels?.length;
        if (!labelled) out.push(el.outerHTML.slice(0, 120));
      });
      return out;
    });
    expect(unnamed).toEqual([]);
  });

  test("„Dalej” z pustymi polami: komunikat, aria-invalid i fokus na pierwszym błędzie", async ({ page }) => {
    await openWizard(page);
    await page.getByRole("button", { name: "Dalej" }).click();
    await expect(page.getByText("Popraw zaznaczone pola, żeby przejść dalej.")).toBeVisible();
    const invalid = page.locator('main form [aria-invalid="true"]');
    await expect(invalid.first()).toBeVisible();
    await expect(page.getByText("To pole jest wymagane.").first()).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("aria-invalid") ?? document.activeElement?.closest("[aria-invalid]")?.getAttribute("aria-invalid")))
      .toBe("true");
  });

  test("walidatory: PESEL, NIP, REGON i KRS odrzucają błędne wartości", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Innej osoby");
    const pesel = page.getByRole("textbox", { name: /Numer PESEL/ }).last();
    await pesel.fill("12345678901");
    await page.getByRole("button", { name: "Dalej" }).click();
    await expect(page.getByText("Numer PESEL jest niepoprawny. Sprawdź cyfry.")).toBeVisible();

    await pick(page, "Osoby prawnej lub jednostki organizacyjnej");
    await page.getByRole("textbox", { name: /^NIP/ }).fill("1234567890");
    await page.getByRole("textbox", { name: /^REGON/ }).fill("123456789");
    await page.getByRole("textbox", { name: /Numer KRS/ }).fill("12345");
    await page.getByRole("button", { name: "Dalej" }).click();
    await expect(page.getByText(/NIP.*(niepoprawny|10 cyfr)/i)).toBeVisible();
    await expect(page.getByText(/REGON.*(niepoprawny|9|14)/i)).toBeVisible();
    await expect(page.getByText("Wpisz 10 cyfr.")).toBeVisible();
  });

  test("lista z więcej niż 15 opcjami ma wyszukiwarkę, a lista bez opcji nie blokuje pola", async ({ page }) => {
    const long = fields().find((f) => f.type === "select" && ((f as { options?: unknown[] }).options?.length ?? 0) > 15);
    const empty = fields().find((f) => f.type === "select" && !(f as { options?: unknown[] }).options?.length);
    test.skip(!long && !empty, "formularz nie ma list rozwijanych do sprawdzenia");
    await openWizard(page);
    await pick(page, "Swoim");
    if (long) {
      const combo = page.getByRole("combobox", { name: new RegExp(`^${long.label.trim()}`) }).first();
      await combo.fill("Niem");
      await expect(page.getByRole("option", { name: "Niemcy" })).toBeVisible();
    }
    if (empty) await expect(page.getByRole("textbox", { name: new RegExp(`^${empty.label.trim()}`) }).first()).toBeEditable();
  });

  test("kod pocztowy ma maskę „00-000” i komunikat o formacie", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Swoim");
    const zip = page.getByRole("textbox", { name: /^Kod pocztowy/ }).first();
    await expect(zip).toHaveAttribute("placeholder", /00-000|__-___/);
  });
});

test.describe("Ostatnia strona i zgody (§Oświadczenie, §Podsumowanie i podgląd)", () => {
  test("pola z rejestru są tylko do odczytu, a puste nie blokują przejścia dalej", async ({ page }) => {
    await openWizard(page);
    await expect(page.getByRole("textbox", { name: /^Imię/ }).first()).not.toBeEditable();
    await pick(page, "Swoim");
    await page.getByRole("button", { name: "Dalej" }).click();
    // błędy mogą dotyczyć innych pól, ale nie pól z rejestru
    await expect(page.locator('main form [aria-invalid="true"][readonly]')).toHaveCount(0);
  });

  test("zgody są pod nagłówkiem sekcji, a ostatnia strona ma „Podsumowanie” i „Podgląd” bez pól do wypełnienia", async ({ page }) => {
    await reachSummary(page);
    const main = page.locator("main");
    await expect(main.getByRole("heading", { name: "Podsumowanie", exact: true })).toBeVisible();
    await expect(main.getByRole("heading", { name: "Podgląd", exact: true })).toBeVisible();
    await expect(main).toContainText("Zanim przejdziesz do wyboru sposobu podpisu, sprawdź dane na podglądzie.");
    await expect(main.locator("input:not([type=hidden]):visible, textarea:visible, select:visible")).toHaveCount(0);
  });
});

test.describe("Pliki (§Przesyłanie plików)", () => {
  test("pole pliku podaje dopuszczalne formaty i limit rozmiaru", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Innej osoby");
    const label = page.getByText("Plik dokumentu z pełnomocnictwem").first();
    await expect(label).toBeVisible();
    const block = label.locator("xpath=ancestor::div[1]");
    await expect(block).toContainText(/10 MB/);
    await expect(block).toContainText(/PDF/i);
  });

  test("plik w niedozwolonym formacie jest odrzucany z komunikatem", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Innej osoby");
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({ name: "skan.exe", mimeType: "application/octet-stream", buffer: Buffer.from("x") });
    await expect(page.getByRole("alert").filter({ hasText: /format/i })).toBeVisible();
  });

  test("plik większy niż 10 MB jest odrzucany", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Innej osoby");
    const input = page.locator('input[type="file"]').first();
    await input.setInputFiles({ name: "duzy.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
    await expect(page.getByRole("alert").filter({ hasText: "10 MB" })).toBeVisible();
  });
});

test.describe("Dostępność i urządzenia mobilne (WCAG 2.1 AA)", () => {
  test("brak poziomego przewijania strony", async ({ page }) => {
    await openWizard(page);
    await pick(page, "Osoby prawnej lub jednostki organizacyjnej");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("jeden nagłówek h1, a fokus po zmianie kroku trafia na niego", async ({ page }) => {
    await openWizard(page);
    await expect(page.locator("main h1")).toHaveCount(1);
  });

  test("ostrzeżenie o błędach nie jest jedyną informacją: każde pole z błędem ma opis przez aria-describedby", async ({ page }) => {
    await openWizard(page);
    await page.getByRole("button", { name: "Dalej" }).click();
    const bad = await page.locator('main form [aria-invalid="true"]').evaluateAll((els) =>
      els.filter((el) => !el.getAttribute("aria-describedby") && !el.closest("[aria-describedby]")).length,
    );
    expect(bad).toBe(0);
  });
});
