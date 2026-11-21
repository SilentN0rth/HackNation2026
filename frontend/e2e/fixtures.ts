import { test as base, expect, type Page } from "@playwright/test";

/** Każdy test zbiera błędy konsoli, wyjątki strony i błędy hydratacji – na końcu muszą być puste. */
export const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" || /hydrat/i.test(msg.text())) errors.push(`[console.${msg.type()}] ${msg.text()}`);
    });
    page.on("pageerror", (err) => errors.push(`[pageerror] ${err.message}`));
    await provide(errors);
    expect(errors, errors.join("\n")).toEqual([]);
  },
});

export async function waitForApp(page: Page) {
  await page.waitForLoadState("networkidle");
  await expect(page.getByRole("status").filter({ hasText: "Wczytywanie" })).toHaveCount(0, { timeout: 10_000 });
}

export { expect };
