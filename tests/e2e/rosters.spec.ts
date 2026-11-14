import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

const ktm = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kathmandu" }).format(d);
/** A day `n` days ahead in Nepal, and the Sunday its roster week starts on. */
function dayAhead(n: number) {
  const day = ktm(new Date(Date.now() + n * 86_400_000));
  const t = new Date(`${day}T00:00:00Z`);
  return { day, week: new Date(t.getTime() - t.getUTCDay() * 86_400_000).toISOString().slice(0, 10) };
}

test("a manager plans a shift, a bad shift is caught, publishing shows the cashier their shift on Today", async ({ page }) => {
  // the day after tomorrow: always inside the cashier's "next 7 days" (next week's Sunday isn't, when today is a
  // Sunday), and never the swap test's "tomorrow"
  const { day, week } = dayAhead(2);
  await signIn(page, "owner", "/admin/rosters");
  await page.getByRole("link", { name: "Asson Flagship", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Rosters · Asson Flagship" })).toBeVisible();
  await page.goto(`${page.url().replace(/&week=.*$/, "")}&week=${week}`);
  const cell = page.getByLabel(`Ram Cashier ${day}`);
  await expect(cell).toBeVisible();

  // an impossible shift time can't be saved
  await cell.fill("25-30");
  await expect(page.getByRole("button", { name: /^Save 1 change$/ })).toBeDisabled();
  await cell.fill("10-18");
  const save = page.getByRole("button", { name: /^Save 1 change$/ });
  if (await save.isVisible()) { // already 10-18 when a retry runs against the same database
    await save.click();
    await expect(page.getByText(/^Saved: 1 set, 0 removed$/)).toBeVisible();
  }
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.getByRole("button", { name: "Publish to staff" }).click();
  await expect(page.getByText(/^Published: staff can see their \d+ shifts$/)).toBeVisible();
  await expect(page.getByText(/^published /)).toBeVisible();

  // the cashier sees it among the next 7 days
  await page.context().clearCookies({ name: /^(?!asson_consent$)/ }); // keep the cookie-banner answer
  await signIn(page, "cashier", "/admin/today");
  const mine = page.locator("li").filter({ hasText: day.slice(5) }).filter({ hasText: "Asson Flagship" });
  await expect(mine).toContainText("10–18");
});

test("a cashier gives tomorrow's shift to a colleague: they accept, the owner approves, and it moves to them", async ({ page }) => {
  // tomorrow in Nepal, and the week it falls in
  const { day: tomorrow, week } = dayAhead(1);

  await signIn(page, "owner", "/admin/rosters");
  await page.getByRole("link", { name: "Asson Flagship", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Rosters · Asson Flagship" })).toBeVisible();
  await page.goto(`${page.url().replace(/&week=.*$/, "")}&week=${week}`);
  await page.getByLabel(`Ram Cashier ${tomorrow}`).fill("11-19");
  await page.getByRole("button", { name: /^Save \d+ changes?$/ }).click();
  await expect(page.getByText(/^Saved: 1 set/)).toBeVisible();
  await page.getByRole("button", { name: "Publish to staff" }).click();
  await expect(page.getByText(/^Published: staff can see/)).toBeVisible();

  await page.context().clearCookies({ name: /^(?!asson_consent$)/ }); // keep the cookie-banner answer
  await signIn(page, "cashier", "/admin/today");
  const row = page.locator("li").filter({ hasText: tomorrow.slice(5) }).filter({ hasText: "11–19" });
  await row.getByRole("button", { name: "Swap" }).click();
  await row.getByLabel("Colleague").selectOption({ label: "Sita Manager" });
  await row.getByRole("button", { name: "Ask them" }).click();
  await expect(page.getByText("Asked: they accept, then a manager approves")).toBeVisible();
  await expect(page.getByText("waiting for Sita Manager")).toBeVisible();

  await page.context().clearCookies({ name: /^(?!asson_consent$)/ }); // keep the cookie-banner answer
  await signIn(page, "manager", "/admin/today");
  await page.getByRole("listitem").filter({ hasText: "Ram Cashier gives" }).getByRole("button", { name: "Accept" }).click();
  await expect(page.getByText("Accepted: a manager approves it next")).toBeVisible();

  await page.context().clearCookies({ name: /^(?!asson_consent$)/ }); // keep the cookie-banner answer
  await signIn(page, "owner", "/admin/rosters");
  await page.getByRole("listitem").filter({ hasText: "Ram Cashier gives" }).getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Approved: the roster is updated")).toBeVisible();

  await page.context().clearCookies({ name: /^(?!asson_consent$)/ }); // keep the cookie-banner answer
  await signIn(page, "manager", "/admin/today");
  await expect(page.locator("li").filter({ hasText: tomorrow.slice(5) }).filter({ hasText: "11–19" }).filter({ hasNotText: "gives" })).toContainText("Asson Flagship");
  await expect(page.getByText("approved", { exact: true })).toBeVisible();
});
