import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner starts a VAT return for a past Nepali month, sees its figures and marks it filed", async ({ page }) => {
  // a distinct 30-day period in the past for every run (periods can't overlap)
  const idx = Math.floor(Date.now() / 1000) % 290; // 2000 … mid-2025: always in the past
  const from = new Date(Date.UTC(2000, 0, 1) + idx * 31 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(`${from}T00:00:00Z`) + 29 * 86_400_000).toISOString().slice(0, 10);
  const label = `Test month ${idx}`;
  page.on("dialog", (d) => d.accept());
  await signIn(page, "owner", "/admin/finance");
  await page.getByRole("link", { name: "VAT", exact: true }).click();
  await expect(page.getByRole("heading", { name: "VAT returns" })).toBeVisible();
  await page.getByLabel("Nepali month").fill(label);
  await page.getByLabel("First day").fill(from);
  await page.getByLabel("Last day").fill(to);
  await page.getByRole("button", { name: "Start return" }).click();
  const card = page.locator("div.rounded-lg").filter({ has: page.getByRole("heading", { name: new RegExp(`^${label} ·`) }) });
  await expect(card).toBeVisible();
  await expect(card.getByText("Output VAT (sales less returns)")).toBeVisible();
  await expect(card.getByText("Draft")).toBeVisible();
  await card.getByLabel("Acknowledgement number").fill(`ACK-${idx}`);
  await card.getByRole("button", { name: "Mark filed" }).click();
  await expect(card.getByText(new RegExp(`ack ACK-${idx}`))).toBeVisible();
});
