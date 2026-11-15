import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** How many price-list rows the till has saved in its IndexedDB. */
const savedRows = (page: Page) => page.evaluate(() => new Promise<number>((resolve) => {
  const req = indexedDB.open("asson-till", 1);
  req.onerror = () => resolve(0);
  req.onsuccess = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains("kv")) return resolve(0);
    const get = db.transaction("kv").objectStore("kv").get("priceList");
    get.onsuccess = () => resolve(get.result?.rows?.length ?? 0);
    get.onerror = () => resolve(0);
  };
}));

const shiftSales = async (page: Page) => Number((await page.getByText(/shift opened .* \d+ sales/).textContent())?.match(/(\d+) sales/)?.[1]);

test("the till keeps selling when the internet drops, and the sale syncs into the shift when it's back", async ({ page, context }) => {
  await signIn(page, "cashier", "/admin/pos");
  const opening = page.getByLabel("Opening cash (Rs.)");
  await expect(opening.or(page.getByLabel("Scan or search"))).toBeVisible();
  if (await opening.isVisible()) {
    await opening.fill("5000");
    await page.getByRole("button", { name: "Open shift" }).click();
  }
  await expect(page.getByLabel("Scan or search")).toBeVisible();
  // online, the till saves this shop's price list on the device
  await expect.poll(() => savedRows(page), { timeout: 20_000 }).toBeGreaterThan(10);
  const before = await shiftSales(page);

  await context.setOffline(true);
  await expect(page.getByText("Offline: sales are saved on this device")).toBeVisible();
  // what can't be safe offline is switched off
  await expect(page.getByRole("button", { name: "Return / exchange" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Pickups" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Store credit" })).toBeDisabled();

  const scan = page.getByLabel("Scan or search");
  await scan.fill("AS-01104");
  await scan.press("Enter");
  await expect(page.getByText("Oxford Button-Down Shirt")).toBeVisible();
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page.getByLabel("Cash received").fill("3000");
  await page.getByRole("button", { name: /Save sale offline/ }).click();
  await expect(page.getByText("Saved on this device · pending sync")).toBeVisible();
  await expect(page.getByText(/^OFF-[A-Z0-9]{6}$/)).toBeVisible();
  await expect(page.getByText(/Give change: Rs\. 601/)).toBeVisible();
  await expect(page.locator("#till-receipt")).toContainText("OFFLINE · PENDING SYNC");
  await page.getByRole("button", { name: "New sale" }).click();

  await expect(page.getByText(/1 waiting to sync/)).toBeVisible();
  // the drawer count would miss it: no closing until it has synced
  await expect(page.getByRole("button", { name: /Sync offline sales to close/ })).toBeDisabled();

  await context.setOffline(false);
  await expect(page.getByText("1 offline sale sent to the server")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/waiting to sync/)).toHaveCount(0);
  await expect.poll(() => shiftSales(page)).toBe(before + 1);
  await expect(page.getByRole("button", { name: "Close shift" })).toBeEnabled();
});
