import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner runs a sale: products added by search, it starts now (sale price on the shop, old price struck through), ending puts the price back", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  // the shelf price before
  await page.goto("/p/two-piece-wool-suit");
  const shelf = (await page.locator("main").getByText(/^Rs\. [\d,]+$/).first().innerText()).trim();

  await signIn(page, "owner", "/admin/markdowns");
  const ktm = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Kathmandu", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(d).replace(" ", "T");
  await page.getByLabel("Sale name").fill(`E2E sale ${Date.now()}`);
  await page.getByLabel("Starts").fill(ktm(new Date(Date.now() - 60_000)));
  await page.getByLabel("Ends").fill(ktm(new Date(Date.now() + 7 * 86_400_000)));
  await page.getByRole("button", { name: "Draft sale" }).click();
  await expect(page.getByRole("heading", { name: /^SALE-\d+ · E2E sale/ })).toBeVisible();

  await page.getByLabel("Product search").fill("Two-Piece Wool Suit");
  await page.getByLabel("Percent off").fill("10");
  await page.getByRole("button", { name: "Add products" }).click();
  await expect(page.getByText("1 product(s) added")).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: "Two-Piece Wool Suit" })).toContainText("10%");
  const below = page.getByLabel(/Below margin is OK/);
  if (await below.isVisible()) await below.check();
  await page.getByRole("button", { name: "Schedule" }).click();
  await expect(page.getByText("live", { exact: true })).toBeVisible();
  const sale = (await page.getByRole("row").filter({ hasText: "Two-Piece Wool Suit" }).locator("td").nth(2).innerText()).trim();

  // the shop shows the sale price with the old one struck through
  await page.goto("/p/two-piece-wool-suit");
  await expect(page.locator("main").getByText(sale).first()).toBeVisible();
  await expect(page.locator("main").locator("s, del, .line-through").filter({ hasText: shelf }).first()).toBeVisible();

  // end it: the price goes back
  await page.goBack();
  await page.getByRole("button", { name: "End sale now" }).click();
  await expect(page.getByText("Ended: prices put back")).toBeVisible();
  await page.goto("/p/two-piece-wool-suit");
  await expect(page.locator("main").getByText(shelf).first()).toBeVisible();
});
