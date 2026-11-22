/**
 * Zgodność z dokumentem „Dane inicjalne” (zadanie rozszerzające): pole zasilane z rejestru ma
 * źródło i atrybut w `defaultValue` (ŹRÓDŁO.atrybut), `defaultValueType: EXTERNAL_SYSTEM` oraz `readOnly`,
 * a obywatel nie może go zmienić ani dopisać brakujących danych.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { login, screenshot, trackConsoleErrors } from "./helpers";

const API = "/api/payload";
const ROOT = path.resolve(import.meta.dirname, "../../..");
const FILE = "01_wniosek_o_ustalenie_numeru_porzadkowego.json";

const SOURCES = ["PESEL", "PESEL_ADDRESS", "MLPZ"];
const PESEL_ATTRS = "pesel name surname birthDate citizenship motherName birthPlace motherSurname sex fatherName secondName birthCountry foreignBirthUSC familyName fatherSurname maritalStatus".split(" ");
const MLPZ_ATTRS =
  "name secondName surname pesel phoneNumber email country voivodeship district community place postCode street building apartment institutionName descriptiveOrganizationName".split(" ");
const ADDRESS_PARTS = "Voivodeship District Community Place StreetType Street HouseNumber ApartmentNumber PostalCode".split(" ");
const ADDRESS_ATTRS = ["temporary", "permanent"].flatMap((k) => ADDRESS_PARTS.map((p) => `${k}Address${p}`));

type Field = { title: string; type: string; readOnly: boolean; defaultValue?: string; defaultValueType?: string; repeatingSectionGrid?: { field: Field }[] };
type Coi = { tabs: { questions: { field: Field }[] }[] };

function externalFields(coi: Coi): Field[] {
  const out: Field[] = [];
  const walk = (cells: { field: Field }[]) =>
    cells.forEach(({ field }) => {
      if (field.defaultValueType) out.push(field);
      walk(field.repeatingSectionGrid ?? []);
    });
  coi.tabs.forEach((t) => walk(t.questions));
  return out;
}

const demo = JSON.parse(readFileSync(path.join(ROOT, "apps/api/data/prefill_demo.json"), "utf8")) as Record<string, string>;
const coi = JSON.parse(readFileSync(path.join(ROOT, "outputs", FILE), "utf8")) as Coi;

test.describe("dane inicjalne – katalog źródeł i atrybutów", () => {
  test("makieta rejestrów ma wszystkie atrybuty z dokumentu (16 + 18 + 17)", () => {
    expect(PESEL_ATTRS).toHaveLength(16);
    expect(ADDRESS_ATTRS).toHaveLength(18);
    expect(MLPZ_ATTRS).toHaveLength(17);
    const expected = [
      ...PESEL_ATTRS.map((a) => `PESEL.${a}`),
      ...ADDRESS_ATTRS.map((a) => `PESEL_ADDRESS.${a}`),
      ...MLPZ_ATTRS.map((a) => `MLPZ.${a}`),
    ];
    expect(Object.keys(demo).sort()).toEqual(expected.sort());
  });

  test("pola z gotowego JSON-a: jedno źródło, jeden atrybut, EXTERNAL_SYSTEM i readOnly", () => {
    const fields = externalFields(coi);
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      expect(f.defaultValueType, f.title).toBe("EXTERNAL_SYSTEM");
      expect(f.readOnly, `${f.title}: pole z rejestru musi być readOnly`).toBe(true);
      const [source, attr, ...rest] = (f.defaultValue ?? "").split(".");
      expect(rest, `${f.title}: tylko jeden atrybut`).toEqual([]);
      expect(SOURCES, f.title).toContain(source);
      expect(Object.keys(demo), f.title).toContain(`${source}.${attr}`);
    }
  });
});

test.describe("dane inicjalne – widok obywatela", () => {
  let errors: string[];
  let formId: number;
  let mediaId: number | undefined;

  test.afterAll(async ({ browser }) => {
    const page = await browser.newPage();
    await login(page);
    if (formId) await page.request.delete(`${API}/forms/${formId}`);
    if (mediaId) await page.request.delete(`${API}/media/${mediaId}`);
    await page.close();
  });

  async function openCitizenForm(page: Page) {
    await page.goto(`/citizen/form/${formId}`);
    await page.getByRole("button", { name: "Tak, uzupełnij" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  test("przygotowanie: wgranie JSON-a, rejestr z danymi i publikacja", async ({ page }) => {
    test.setTimeout(120_000);
    errors = trackConsoleErrors(page, [/Failed to load resource/]);
    await login(page);

    // Rejestr demo: wszystkie atrybuty z dokumentu, poza zagranicznym USC (osoba urodzona w Polsce).
    const registry = await page.request.post(`${API}/globals/registry`, { data: { prefill: { ...demo, "PESEL.name": "Jan" } } });
    expect(registry.ok()).toBe(true);

    await page.goto("/official/upload");
    const created = page.waitForResponse((r) => r.url().includes(`${API}/forms?`) && r.request().method() === "POST", { timeout: 60_000 });
    await page.getByTestId("upload-input").setInputFiles({ name: FILE, mimeType: "application/json", buffer: readFileSync(path.join(ROOT, "outputs", FILE)) });
    const doc = (await (await created).json()).doc as { id: number; source?: number; aiStatus?: string };
    formId = doc.id;
    mediaId = doc.source;
    expect(doc.aiStatus).toBe("ready");

    await page.waitForURL(new RegExp(`/official/(forms|drafts)/${formId}`), { timeout: 30_000 });
    await page.goto(`/official/forms/${formId}/editor`);
    const critical = page.getByTestId("flag-card").filter({ hasText: "Krytyczna" }).filter({ has: page.getByRole("button", { name: "Poprawione" }) });
    for (let left = await critical.count(); left > 0; left--) {
      await critical.first().getByRole("button", { name: "Poprawione" }).click();
      await expect(critical).toHaveCount(left - 1);
    }
    const publish = page.getByRole("button", { name: "Zatwierdź i opublikuj" });
    await expect(publish).toBeEnabled();
    await page.waitForTimeout(800);
    await publish.click();
    await expect(page.getByTestId("editor-notice")).toContainText("Opublikowano");
    expect(errors).toEqual([]);
  });

  test("po zgodzie pola z rejestru są wypełnione i tylko do odczytu", async ({ page }, testInfo) => {
    await openCitizenForm(page);
    const external = externalFields(coi);
    let checked = 0;
    for (const f of external) {
      const input = page.getByLabel(f.title, { exact: false }).first();
      if (!(await input.count())) continue; // pole na innej stronie kreatora lub ukryte warunkiem
      const expected = demo[f.defaultValue!];
      await expect(input, f.title).toHaveJSProperty("readOnly", true);
      if (expected) await expect(input, f.title).toHaveValue(expected);
      checked++;
    }
    expect(checked, "przynajmniej część pól z rejestru jest na pierwszej stronie").toBeGreaterThan(0);
    await screenshot(page, testInfo, "dane-inicjalne-wypelnione");
  });

  test("brakujący atrybut zostaje pusty i nie da się go wpisać", async ({ page }) => {
    await login(page);
    const reg = await page.request.post(`${API}/globals/registry`, { data: { prefill: { ...demo, "PESEL.surname": "" } } });
    expect(reg.ok()).toBe(true);
    await openCitizenForm(page);
    const surname = externalFields(coi).find((f) => f.defaultValue === "PESEL.surname");
    test.skip(!surname, "formularz nie ma pola PESEL.surname");
    const input = page.getByLabel(surname!.title, { exact: false }).first();
    await expect(input).toHaveValue("");
    await expect(input).toHaveJSProperty("readOnly", true);
    await input.fill("Wpisane ręcznie", { force: true }).catch(() => undefined);
    await expect(input).toHaveValue("");
  });
});
