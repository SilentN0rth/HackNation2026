/** Logowanie jednym kliknięciem na wersji demonstracyjnej (DEMO_LOGIN=true) – konto urzędnika, nie administratora. */
import { expect, test } from "@playwright/test";

test("przycisk demo loguje urzędnika bez uprawnień administratora", async ({ page }) => {
  await page.goto("/official/login");
  const demo = page.getByTestId("demo-login");
  await expect(page.locator("#field-email")).toBeVisible();
  test.skip(!(await demo.isVisible()), "DEMO_LOGIN nie jest włączone na tym serwerze");

  await demo.click();
  await page.waitForURL((u) => u.pathname.startsWith("/official") && !u.pathname.includes("login"));
  const me = await (await page.request.get("/api/payload/users/me")).json();
  expect(me.user).toMatchObject({ email: "demo.urzednik@example.gov.pl", role: "official" });
  // Rola urzędnika nie zakłada kont.
  const created = await page.request.post("/api/payload/users", { data: { email: "intruz@example.gov.pl", password: "x".repeat(12), name: "Intruz" } });
  expect(created.status()).toBe(403);
});
