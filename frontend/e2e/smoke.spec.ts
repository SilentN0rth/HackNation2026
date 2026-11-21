import { expect, test, waitForApp } from "./fixtures";

const ROUTES = ["/official", "/official/upload", "/official/audit", "/citizen", "/citizen/applications"];

for (const route of ROUTES) {
  test(`${route} renderuje się bez błędów`, async ({ page, errors }) => {
    await page.goto(route);
    await waitForApp(page);
    await expect(page.locator("h1").first()).toBeVisible();
    void errors;
  });
}

test("/ przekierowuje na panel urzędnika", async ({ page, errors }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/official$/);
  void errors;
});
