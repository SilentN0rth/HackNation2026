/**
 * Zgodność z opisem importowanego pliku JSON (OpisImportowanegoPlikuJSON.docx):
 * wgranie gotowego pliku COI w panelu, a potem sprawdzenie JSON-a z zakładki „JSON” punkt po punkcie.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { screenshot, SEED_USER, trackConsoleErrors } from "./helpers";

const API = "/api/payload";

/** Logowanie bez czekania na pulpit: konto z seeda może mieć inny widok startowy (lista formularzy). */
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/official/login");
  await page.locator("#field-email").fill(SEED_USER.email);
  await page.locator("#field-password").fill(SEED_USER.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL((url) => url.pathname.startsWith("/official") && !url.pathname.includes("/login"));
}
const OUTPUTS = path.resolve(import.meta.dirname, "../../../outputs");
const FILES = [
  "01_wniosek_o_ustalenie_numeru_porzadkowego.json",
  "05_wniosek_o_stwierdzenie_nadplaty_podatku.json",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GRID_COLUMNS = 3;
const TAB_TYPES = ["MAIN", "FINISH"];
const STATE_TYPES = ["SHOW", "READ_ONLY"];

type Field = Record<string, unknown> & { id: string; type: string; techName: string; repeatingSectionGrid?: Cell[] };
type Cell = { x: number; y: number; rows: number; cols: number; field: Field };
type Tab = { id: string; title: string; type: string; questions: Cell[] };
type Coi = { title: string; tabs: Tab[]; flow: { links: { id: string; source: string; target: string }[] } };

/** Wszystkie pola (także zagnieżdżone w sekcjach powtarzających) wraz z komórką siatki. */
function cells(coi: Coi): Cell[] {
  const out: Cell[] = [];
  const walk = (list: Cell[]) =>
    list.forEach((c) => {
      out.push(c);
      walk(c.field.repeatingSectionGrid ?? []);
    });
  coi.tabs.forEach((t) => walk(t.questions));
  return out;
}

/** Każdy punkt tabeli z dokumentu opisu pliku. */
function expectMatchesSpec(coi: Coi) {
  expect(typeof coi.title, "title: tytuł formularza").toBe("string");
  expect(coi.title.length).toBeGreaterThan(0);

  expect(Array.isArray(coi.tabs), "tabs: tablica").toBe(true);
  for (const tab of coi.tabs) {
    expect(tab.id, "tabs.id: UUID").toMatch(UUID);
    expect(typeof tab.title).toBe("string");
    expect(TAB_TYPES, "tabs.type: MAIN albo FINISH").toContain(tab.type);
    expect(Array.isArray(tab.questions), "tabs.questions: tablica").toBe(true);
  }

  const all = cells(coi);
  expect(all.length).toBeGreaterThan(0);
  const ids = new Set<string>();
  const techNames = new Set<string>();
  for (const c of all) {
    for (const k of ["x", "y", "rows", "cols"] as const) {
      expect(Number.isInteger(c[k]) && c[k] >= 0, `tabs.questions.${k}: liczba od 0`).toBe(true);
    }
    expect(c.rows, "rows >= 1").toBeGreaterThanOrEqual(1);
    expect(c.cols, "cols >= 1").toBeGreaterThanOrEqual(1);
    // grid-area: {y+1} / {x+1} / span {rows} / span {cols} – pole nie może wychodzić poza siatkę
    expect(c.x + c.cols, `pole ${c.field.techName} mieści się w ${GRID_COLUMNS} kolumnach`).toBeLessThanOrEqual(GRID_COLUMNS);

    const f = c.field;
    expect(f.id, "field.id: UUID").toMatch(UUID);
    expect(ids.has(f.id), `field.id unikalne (${f.id})`).toBe(false);
    ids.add(f.id);
    expect(f.techName, "field.techName").toMatch(/^[a-z0-9_]+$/);
    expect(techNames.has(f.techName), `techName unikalne (${f.techName})`).toBe(false);
    techNames.add(f.techName);
    expect(typeof f.title).toBe("string");
    expect(typeof f.description).toBe("string");
    expect(Array.isArray(f.options)).toBe(true);
    expect(Array.isArray(f.validation) && (f.validation as unknown[]).every((v) => typeof v === "string"), "validation: tablica stringów").toBe(true);
    expect(typeof f.readOnly).toBe("boolean");
    expect(Array.isArray(f.repeatingSectionGrid), "repeatingSectionGrid: tablica").toBe(true);
    expect(typeof f.questionOrder).toBe("number");
    expect(typeof f.tooltipMessage).toBe("string");
    // Opis mówi „string”, ale wzorce organizatora mają tablicę wartości w polach SELECT – emitujemy jak we wzorcach.
    if (f.defaultValue !== undefined) {
      if (f.type === "SELECT") expect(Array.isArray(f.defaultValue), "defaultValue SELECT: tablica jak we wzorcach").toBe(true);
      else expect(typeof f.defaultValue, "defaultValue: string").toBe("string");
    }
    if (f.defaultValueType) expect(f.defaultValueType, "defaultValueType").toBe("EXTERNAL_SYSTEM");
    if (f.dictionaryName !== undefined) expect(typeof f.dictionaryName).toBe("string");

    for (const o of (f.options as { id: string; name: string; techName: string }[]) ?? []) {
      expect(typeof o.id).toBe("string");
      expect(typeof o.name).toBe("string");
      expect(typeof o.techName).toBe("string");
    }
    for (const s of (f.states as { type: string; query: string }[]) ?? []) {
      expect(STATE_TYPES, "states.type").toContain(s.type);
      expect(typeof s.query, "states.query: JSONata").toBe("string");
    }
    if (f.type === "CONSENT_SECTION") {
      const cfg = f.consentSectionConfig as { consents: { description: string; required: boolean }[]; files: unknown[] };
      expect(cfg, "consentSectionConfig dla CONSENT_SECTION").toBeTruthy();
      expect(cfg.consents.length).toBeGreaterThan(0);
      for (const consent of cfg.consents) {
        expect(typeof consent.description, "consents.description").toBe("string");
        expect(typeof consent.required, "consents.required").toBe("boolean");
      }
      expect(Array.isArray(cfg.files), "consentSectionConfig.files").toBe(true);
    } else {
      expect(f.consentSectionConfig, "consentSectionConfig tylko dla CONSENT_SECTION").toBeUndefined();
    }
  }

  // flow: przejścia między istniejącymi stronami
  const tabIds = new Set(coi.tabs.map((t) => t.id));
  expect(coi.flow && Array.isArray(coi.flow.links), "flow.links: tablica").toBe(true);
  for (const l of coi.flow.links) {
    expect(l.id, "flow.links.id: UUID").toMatch(UUID);
    expect(tabIds.has(l.source), "flow.links.source wskazuje stronę").toBe(true);
    expect(tabIds.has(l.target), "flow.links.target wskazuje stronę").toBe(true);
  }
}

test.describe("import i eksport pliku JSON COI", () => {
  let errors: string[];
  const cleanup: string[] = [];

  test.beforeEach(async ({ page }) => {
    errors = trackConsoleErrors(page, [/Failed to load resource/]);
    await signIn(page);
  });

  test.afterEach(async ({ page }) => {
    for (const url of cleanup.splice(0)) await page.request.delete(url);
    expect(errors, "błędy w konsoli przeglądarki").toEqual([]);
  });

  for (const name of FILES) {
    test(`wgranie ${name.slice(0, 2)} → JSON w edytorze zgodny z opisem`, async ({ page }, testInfo) => {
      test.setTimeout(120_000);
      const original = JSON.parse(readFileSync(path.join(OUTPUTS, name), "utf8")) as Coi;

      await page.goto("/official/upload");
      const created = page.waitForResponse((r) => r.url().includes(`${API}/forms?`) && r.request().method() === "POST", { timeout: 60_000 });
      await page.getByTestId("upload-input").setInputFiles({ name, mimeType: "application/json", buffer: readFileSync(path.join(OUTPUTS, name)) });
      const form = (await (await created).json()).doc as { id: number; source: number; aiStatus?: string; aiError?: string };
      cleanup.push(`${API}/forms/${form.id}`, `${API}/media/${form.source}`);
      expect(form.aiStatus, form.aiError ?? "import gotowego JSON-a").toBe("ready");

      await page.waitForURL(new RegExp(`/official/(forms|drafts)/${form.id}`), { timeout: 30_000 });
      await page.getByRole("tab", { name: "JSON" }).click();
      const pre = page.locator("pre").filter({ hasText: '"tabs"' });
      await expect(pre).toBeVisible();
      await screenshot(page, testInfo, `coi-json-${name.slice(0, 2)}`);

      const shown = JSON.parse((await pre.textContent()) ?? "") as Coi;
      expectMatchesSpec(shown);

      // Import niczego nie gubi: te same strony, pola i przejścia co w pliku wejściowym.
      expect(shown.title).toBe(original.title);
      expect(shown.tabs.map((t) => [t.id, t.type, t.title])).toEqual(original.tabs.map((t) => [t.id, t.type, t.title]));
      expect(cells(shown).map((c) => c.field.techName)).toEqual(cells(original).map((c) => c.field.techName));
      expect(shown.flow.links.map((l) => [l.source, l.target])).toEqual(original.flow.links.map((l) => [l.source, l.target]));

      // „Pobierz JSON” oddaje ten sam dokument.
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Pobierz JSON" }).click();
      const file = await download;
      expect(file.suggestedFilename()).toMatch(/\.json$/);
      expect(JSON.parse(readFileSync((await file.path())!, "utf8"))).toEqual(shown);
    });
  }

  test("plik .json, który nie jest formularzem COI, jest odrzucony z komunikatem", async ({ page }) => {
    await page.goto("/official/upload");
    await page.getByTestId("upload-input").setInputFiles({ name: "smiec.json", mimeType: "application/json", buffer: Buffer.from('{"a":1}') });
    await expect(page.getByTestId("upload-error").or(page.getByRole("alert")).first()).toBeVisible({ timeout: 30_000 });
    const forms = await (await page.request.get(`${API}/forms`, { params: { draft: "true", depth: "0", limit: "500" } })).json();
    for (const d of forms.docs as { id: number; title: string; source?: number }[]) {
      if (d.title === "Nowy formularz" && d.source) {
        await page.request.delete(`${API}/forms/${d.id}`);
        await page.request.delete(`${API}/media/${d.source}`);
      }
    }
  });
});
