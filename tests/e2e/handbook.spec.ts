import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a cashier follows their handbook path: reads a page, passes its questions, and the manager sees it", async ({ page }) => {
  await signIn(page, "cashier", "/admin/handbook");
  await expect(page.getByRole("heading", { name: "Handbook", level: 1 })).toBeVisible();
  await expect(page.getByText(/^Your path · Cashier$/)).toBeVisible();
  // strategy pages are the owner's only
  await expect(page.getByText("World-class review: where Asson OS stands")).toHaveCount(0);

  // search, then open the welcome page from the path
  await page.getByRole("searchbox", { name: "Search the handbook" }).or(page.getByLabel("Search the handbook")).fill("float");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/pages? for “float”/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Procedure: opening the shop/ }).first()).toBeVisible();
  await page.goto("/admin/handbook/welcome");
  await expect(page.getByRole("heading", { name: "Welcome to Asson", level: 1 })).toBeVisible();
  await expect(page.getByText("Step 1 of your path")).toBeVisible();

  const read = page.getByRole("button", { name: /I’ve read and understood this/ });
  if (await read.isVisible()) await read.click(); // a retry against the same database has already read it
  await expect(page.getByText("You’ve read this page")).toBeVisible();

  // answers are checked on the server; a wrong one is explained
  await page.getByRole("radio", { name: "The cheapest clothes in Nepal" }).check();
  await page.getByRole("radio", { name: /Check the fabric shown on the product/ }).check();
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByText(/^50%: read the page again/)).toBeVisible();
  await page.getByRole("button", { name: "Try again" }).click();
  await page.getByRole("radio", { name: /The brand Nepal trusts/ }).check();
  await page.getByRole("radio", { name: /Check the fabric shown on the product/ }).check();
  await page.getByRole("button", { name: "Check my answers" }).click();
  await expect(page.getByText(/^100%: passed/)).toBeVisible();

  // a link to where it happens in the system works
  await page.goto("/admin/handbook/sys-pos");
  await expect(page.getByRole("heading", { name: "Point of sale (the till)" })).toBeVisible();
  await expect(page.locator("ol").first()).toContainText("Scan");

  // the manager's view
  await page.context().clearCookies({ name: /^(?!asson_consent$)/ });
  await signIn(page, "manager", "/admin/handbook/onboarding");
  const row = page.getByRole("row").filter({ hasText: "Ram Cashier" });
  await expect(row).toContainText("Cashier");
  await expect(row.getByRole("cell").nth(2)).toHaveText(/^[1-9]\d*\/\d+$/); // at least one page done
});

test("the owner sees the world-class review and the roadmap", async ({ page }) => {
  await signIn(page, "owner", "/admin/handbook/worldclass-review");
  await expect(page.getByRole("heading", { name: "World-class review: where Asson OS stands" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Omnichannel order management" })).toBeVisible();
  await page.getByRole("link", { name: /Roadmap: what to build next/ }).first().click();
  await expect(page.getByRole("heading", { name: "Roadmap: what to build next, in order" })).toBeVisible();
  await expect(page.getByText(/Offline till/).first()).toBeVisible();
});
