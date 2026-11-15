import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a till sale prints a numbered tax invoice; a reprint says Copy of original and the books list it", async ({ page }) => {
  await signIn(page, "owner", "/admin/pos");
  const opening = page.getByLabel("Opening cash (Rs.)");
  await expect(opening.or(page.getByLabel("Scan or search"))).toBeVisible();
  const opened = await opening.isVisible();
  if (opened) {
    await opening.fill("5000");
    await page.getByRole("button", { name: "Open shift" }).click();
  }

  const scan = page.getByLabel("Scan or search");
  await scan.fill("AS-01104");
  await scan.press("Enter");
  await expect(page.getByText("Oxford Button-Down Shirt")).toBeVisible();
  await page.getByText("Customer (optional)").click();
  await page.getByLabel("Customer name").fill("Everest Traders");
  await page.getByLabel("Buyer PAN").fill("301234567");
  await page.getByRole("button", { name: "Cash", exact: true }).click();
  await page.getByLabel("Cash received").fill("2399");
  await page.getByRole("button", { name: /Complete sale/ }).click();
  await expect(page.getByText("Sale complete", { exact: false })).toBeVisible();
  const href = await page.getByRole("link", { name: "Print receipt" }).getAttribute("href");

  // the 80 mm invoice: Schedule 6 contents, dates in BS and AD
  const inv = await page.context().newPage();
  await inv.addInitScript(() => { (window as unknown as { printed: number }).printed = 0; window.print = () => { (window as unknown as { printed: number }).printed++; }; });
  await inv.goto(href!);
  const doc = inv.getByRole("article");
  await expect(doc.getByRole("heading", { name: "TAX INVOICE" })).toBeVisible();
  const number = (await doc.getByText(/^FLAGSHIP-\d{4}-\d{6}$/).textContent())!;
  await expect(doc.getByText("Everest Traders")).toBeVisible();
  await expect(doc.getByText("301234567")).toBeVisible();
  await expect(doc.getByText(/ BS \(\d{4}-\d{2}-\d{2} AD\)/)).toBeVisible();
  await expect(doc.getByText("VAT 13%")).toBeVisible();
  await expect(doc.getByText("2,123.01").first()).toBeVisible(); // Rs 2,399 incl. VAT: taxable 2,123.01 + VAT 275.99
  await expect(doc.getByText("275.99")).toBeVisible();
  await expect(doc.getByText(/Two thousand three hundred ninety-nine rupees only/)).toBeVisible();
  await expect(doc.getByText(/Copy of original/)).toHaveCount(0);

  await inv.getByRole("button", { name: "Print", exact: true }).click();
  await expect(inv.getByRole("button", { name: "Print copy (1)" })).toBeVisible();
  expect(await inv.evaluate(() => (window as unknown as { printed: number }).printed)).toBe(1);
  await inv.reload();
  await expect(inv.getByText("Copy of original (1)")).toBeVisible();
  await inv.getByRole("button", { name: "Print copy (1)" }).click();
  await expect(inv.getByRole("button", { name: "Print copy (2)" })).toBeVisible();

  // Finance → Tax invoices lists it with its prints and the CBMS state (off: waiting)
  await inv.goto(`/admin/finance/invoices?q=${number}`);
  const row = inv.getByRole("row", { name: new RegExp(number) });
  await expect(row).toContainText("2 prints (1 copy)");
  await expect(row).toContainText("Waiting");
  await inv.close();

  if (opened) {
    // leave the till as we found it
    await page.getByRole("button", { name: "New sale" }).click();
    await page.getByRole("button", { name: "Close shift" }).click();
    await page.getByLabel("Cash counted (Rs.)").fill("7399");
    await page.getByRole("button", { name: "Close shift" }).last().click();
    await expect(page.getByText("Shift closed")).toBeVisible();
  }
});
