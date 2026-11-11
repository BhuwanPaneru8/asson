import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a wave is picked in one walk, each order is packed by scanning its items (a wrong item is refused), then handed to a courier on a manifest", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await signIn(page, "owner", "/admin/fulfilment");
  await expect(page.getByRole("heading", { name: /^Fulfilment · / })).toBeVisible();
  const start = page.getByRole("button", { name: "Start a wave" });
  test.skip(await start.isDisabled(), "no confirmed orders waiting on this database");
  await page.getByLabel("Orders in the wave").fill("3");
  await start.click();
  await expect(page).toHaveURL(/\/admin\/fulfilment\/wave\//);
  await expect(page.getByRole("heading", { name: /^W-\d+ · / })).toBeVisible();
  const firstSlot = page.getByRole("listitem").filter({ hasText: /^#1 · / }).first();
  const orderNo = (await firstSlot.innerText()).match(/AS\d+/)![0];
  await page.getByRole("button", { name: "Everything is picked" }).click();
  await expect(page.getByText("picked", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Packing station" }).click();
  await page.getByLabel("Order number").fill(orderNo);
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText(/slot 1 of wave W-\d+/)).toBeVisible();
  // a wrong item is refused
  await page.getByLabel("Scan item").fill("NOT-IN-ORDER");
  await page.getByLabel("Scan item").press("Enter");
  await expect(page.getByText("NOT-IN-ORDER isn't in this order: put it back.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Scan every item to pack" })).toBeDisabled();
  // scan every expected unit
  const rows = page.locator("ul li").filter({ hasText: / \/ \d+$/ });
  for (const row of await rows.all()) {
    const text = await row.innerText();
    const sku = text.split(" · ")[0].trim();
    const need = Number(text.match(/\/ (\d+)$/)![1]);
    for (let i = 0; i < need; i++) { await page.getByLabel("Scan item").fill(sku); await page.getByLabel("Scan item").press("Enter"); }
  }
  await page.getByLabel("Weight in grams").fill("650");
  await page.getByRole("button", { name: "Pack", exact: true }).click();
  await expect(page.getByText(`${orderNo} packed`)).toBeVisible();

  // courier hand-over: scan the parcel onto the courier's manifest, the rider counts, every order ships
  // the parcel to ship: one listed as ready (the packed order, unless it's collected from a shop)
  const ready = page.getByText(/^Ready: AS\d+/);
  await expect(ready).toBeVisible();
  const shipNo = (await ready.innerText()).includes(orderNo) ? orderNo : (await ready.innerText()).match(/AS\d+/)![0];
  await page.getByLabel("Courier").selectOption("Upaya City Cargo");
  await page.getByRole("button", { name: "Scan parcels for this courier" }).click();
  await expect(page.getByRole("heading", { name: /^M-\d+ · Upaya City Cargo$/ })).toBeVisible();
  const tracking = `E2E-${Date.now()}`;
  await page.getByLabel("Order number").fill(shipNo);
  await page.getByLabel("Order number").press("Enter");
  await expect(page.getByLabel("Tracking number")).toBeFocused();
  await page.getByLabel("Tracking number").fill(tracking);
  await page.getByLabel("Tracking number").press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Added:" })).toContainText(`Added: ${shipNo} · ${tracking}`);
  await expect(page.getByRole("cell", { name: tracking })).toBeVisible();
  const parcels = Number((await page.locator("tfoot").innerText()).match(/(\d+) parcels?/)![1]);
  await page.getByLabel("Rider's name").fill("E2E Rider");
  await page.getByLabel("Parcels counted").fill(String(parcels + 1));
  await page.getByRole("button", { name: /^Hand over \d+ parcels?$/ }).click();
  await expect(page.getByText(/counted \d+ but the manifest has \d+/).first()).toBeVisible();
  await page.getByLabel("Parcels counted").fill(String(parcels));
  await page.getByRole("button", { name: /^Hand over \d+ parcels?$/ }).click();
  await expect(page.getByText("handed over", { exact: true })).toBeVisible();
  await expect(page.getByText(/handed to E2E Rider/)).toBeVisible();
  await expect(page.getByRole("row").filter({ hasText: tracking })).toContainText("shipped");
});
