import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a guest swaps the size of a delivered shirt; the new size goes out free and staff see the exchange waiting", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  // a guest buys a shirt in M
  await page.goto("/p/oxford-button-down-shirt");
  await page.getByRole("button", { name: /^Size M/ }).click();
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();
  await page.goto("/checkout");
  await page.getByLabel("Email", { exact: true }).fill("e2e.exchange@example.com");
  await page.getByLabel("Mobile number").fill("9841234568");
  await page.getByLabel("Full name").fill("E2E Exchanger");
  await page.getByLabel("Phone", { exact: true }).fill("9841234568");
  await page.getByLabel("District").selectOption("Kathmandu");
  await page.getByLabel("City / municipality").fill("Kathmandu");
  await page.getByLabel("Tole / street, house no.").fill("Baneshwor-10");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible();
  const orderUrl = page.url().replace(/\?.*$/, "");
  const orderNumber = (await page.locator("b", { hasText: /^AS\d{6}$/ }).first().textContent())!;

  // staff take it all the way to delivered
  await signIn(page, "owner", `/admin/orders?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).click();
  for (const step of ["Confirm order", "Mark as packed"]) {
    await page.getByRole("button", { name: step }).click();
    await expect(page.getByText("Order updated").first()).toBeVisible();
    await page.reload();
  }
  await page.getByLabel("Tracking number").fill(`EXE2E${Date.now()}`);
  await page.getByRole("button", { name: "Mark as shipped" }).click();
  await expect(page.getByRole("button", { name: "Mark delivered" })).toBeVisible();
  await page.getByRole("button", { name: "Mark delivered" }).click();
  await expect(page.getByText("This order is delivered. No further steps.").or(page.getByRole("button", { name: "Open return" }))).toBeVisible();

  // the guest, on their order link, swaps M for another size
  await page.context().clearCookies({ name: /^(?!asson_consent$)/ }); // keep the cookie-banner answer
  await page.goto(orderUrl);
  await page.getByRole("button", { name: "Exchange a size" }).click();
  const pick = page.getByLabel(/^New size: Oxford Button-Down Shirt M$/);
  const other = (await pick.locator("option").allTextContents()).find((t) => t.startsWith("New size: "))!;
  await pick.selectOption({ label: other });
  await page.getByRole("button", { name: "Send me the new size" }).click();
  await expect(page.getByText("Exchange confirmed: we'll text you when it's on its way")).toBeVisible();
  await expect(page.getByText(/^Exchange EX-\d+ is on its way: hand the old item to the rider\.$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Return items" })).toHaveCount(0); // exchanged: no refund return

  // staff see it waiting for the old item
  await signIn(page, "owner", "/admin/fulfilment/exchanges");
  await expect(page.getByRole("row").filter({ hasText: orderNumber })).toContainText(`Oxford Button-Down Shirt M`);
  await page.getByLabel("Exchange or order number").fill(orderNumber);
  await page.getByRole("button", { name: "Find" }).click();
  await expect(page.getByText(/hasn't gone out yet|EX-\d+ · from/).first()).toBeVisible();
  // the order page shows it too (and no second swap is offered: the one unit is already exchanged)
  await page.goto(`/admin/orders?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByText(/^Open exchange: EX-\d+/)).toBeVisible();
  await expect(page.getByText("Size exchange for the customer")).toHaveCount(0);
});
