import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.describe.configure({ mode: "serial" });

test("search understands typos and colours", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle"); // a tap before the page's JavaScript is ready goes to /shop instead
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("combobox", { name: "Search products" }).fill("olive hodie");
  await expect(page.getByRole("link", { name: /Classic Pullover Hoodie/ }).first()).toBeVisible();
});

let orderNumber = "";

test("guest buys a shirt with COD and the district's delivery fee", async ({ page }) => {
  await page.goto("/p/oxford-button-down-shirt");
  await page.getByLabel("Your district").selectOption("Chitwan");
  await expect(page.getByText(/Rs\. 150 · arrives \w{3} \d{1,2} \w{3} – \w{3} \d{1,2} \w{3}/)).toBeVisible(); // real dates, 3–5 delivery days
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page.getByText(/Please select a size/)).toBeVisible(); // size is required
  await page.getByRole("button", { name: /^Size M/ }).click();
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();

  await page.goto("/checkout");
  await page.getByLabel("Email", { exact: true }).fill("e2e.shopper@example.com");
  await page.getByLabel("Mobile number").fill("9841234567");
  await page.getByLabel("Full name").fill("E2E Shopper");
  await page.getByLabel("Phone", { exact: true }).fill("9841234567");
  await expect(page.getByLabel("District")).toHaveValue("Chitwan"); // remembered from the product page
  await page.getByLabel("City / municipality").fill("Bharatpur");
  await page.getByLabel("Tole / street, house no.").fill("Narayangadh-3, House 7");
  await expect(page.getByText("Delivery · Chitwan")).toBeVisible();
  await expect(page.getByRole("radio", { name: /^eSewa or Khalti/ })).toHaveCount(0); // online payments on hold
  await page.getByRole("button", { name: "Place order" }).click();

  await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible();
  orderNumber = (await page.locator("b", { hasText: /^AS\d{6}$/ }).first().textContent()) ?? "";
  expect(orderNumber).toMatch(/^AS\d{6}$/);
});

test("ops staff confirm the new order", async ({ page }) => {
  await signIn(page, "owner", "/admin/orders?status=PENDING");
  await page.getByPlaceholder(/Search order/).fill(orderNumber);
  await page.getByRole("button", { name: "Search" }).click();
  await page.getByRole("link", { name: orderNumber }).click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText(/Order updated/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark as packed" })).toBeVisible();
});

test("the shop is in English for everyone, with no language switch (Nepali shop switched off)", async ({ browser }) => {
  const page = await (await browser.newContext({ locale: "ne-NP", extraHTTPHeaders: { "Accept-Language": "ne-NP,ne;q=0.9" } })).newPage();
  await page.context().addCookies([{ name: "asson_lang", value: "ne", url: "http://localhost:3100" }]); // even someone who chose Nepali before
  await page.goto("/c/women");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("button", { name: "नेपाली" })).toHaveCount(0);
  await expect(page.getByText("Free delivery over Rs. 2,500")).toHaveCount(0); // the top bar is gone
});

test("a guest with no email checks out with just their mobile, then tracks the order by that number", async ({ page }) => {
  const mobile = `98${String(Date.now()).slice(-8)}`;
  await page.goto("/p/oxford-button-down-shirt");
  await page.getByRole("button", { name: /^Size L/ }).click();
  await page.getByRole("button", { name: /Add to bag/ }).first().click();
  await expect(page.getByRole("dialog", { name: /Your bag/ })).toBeVisible();

  // the bag's summary adds up: full price, the saving, then the total
  await page.goto("/cart");
  await expect(page.getByText(/^Items \(1\)$/)).toBeVisible();
  await expect(page.getByText("You save", { exact: true })).toBeVisible();
  await expect(page.getByText("Total before delivery").first()).toBeVisible();

  await page.goto("/checkout");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Mobile number").fill(mobile);
  // the delivery phone follows the mobile number: no typing it twice
  await expect(page.getByLabel("Phone", { exact: true })).toHaveValue(mobile);
  await expect(page.getByText("Optional: for your receipt and order updates")).toBeVisible();
  await page.getByLabel("Full name").fill("Mobile Only");
  await page.getByLabel("District").selectOption("Kathmandu");
  await page.getByLabel("City / municipality").fill("Kathmandu");
  await page.getByLabel("Tole / street, house no.").fill("Baneshwor-10");
  await page.getByRole("button", { name: "Place order" }).click();
  await expect(page.getByRole("heading", { name: /Thank you/ })).toBeVisible();
  const number = (await page.locator("b", { hasText: /^AS\d{6}$/ }).first().textContent())!;
  await expect(page.getByText(`We'll text updates to ${mobile}.`)).toBeVisible(); // no email given, and none is claimed

  // a fresh visitor finds it with the order number and the mobile number
  await page.context().clearCookies({ name: /^(?!asson_consent$)/ });
  await page.goto("/track");
  await page.getByLabel("Order number").fill(number);
  await page.getByLabel("Mobile number or email").fill("9800000000");
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "couldn't find an order" })).toBeVisible();
  await page.getByLabel("Mobile number or email").fill(mobile);
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page).toHaveURL(/\/orders\//);
  await expect(page.getByText(number).first()).toBeVisible();
});
