import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the manager counts the safe and banks cash; the owner finds a shortfall on the statement and it goes back on the book", async ({ browser }, info) => {
  const tag = `${Date.now() % 1_000_000}-${info.retry}`;
  const mgr = await (await browser.newContext()).newPage();
  await signIn(mgr, "manager", "/admin/cash");
  await mgr.getByRole("link", { name: "Asson Flagship" }).first().click();
  await expect(mgr.getByRole("heading", { name: "Asson Flagship · count the safe" })).toBeVisible();
  // count what the book says (or start it): read the book, then count Rs 20,000 more by adding it as a starting balance if empty
  const started = await mgr.getByRole("heading", { name: "Record a bank deposit" }).count();
  if (!started) {
    await mgr.getByLabel("Cash counted").fill("20000");
    await mgr.getByRole("button", { name: "Save count" }).click();
    await expect(mgr.getByRole("heading", { name: "Record a bank deposit" })).toBeVisible();
  }
  const bookTitle = async () => Number((await mgr.getByRole("heading", { name: /^Cash book · / }).innerText()).replace(/[^\d]/g, ""));
  const before = await bookTitle();
  test.skip(before < 5000, "the safe holds less than Rs 5,000 on this database");

  await mgr.getByLabel("Deposit amount").fill("5000");
  await mgr.getByLabel("Bank").fill("NIC Asia");
  await mgr.getByLabel("Slip number").fill(`S${tag}`);
  await mgr.getByRole("button", { name: "Record deposit" }).click();
  await expect(mgr.getByText(`NIC Asia slip S${tag}`).first()).toBeVisible();
  expect(await bookTitle()).toBe(before - 5000);

  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/cash");
  const row = owner.getByRole("listitem").filter({ hasText: new RegExp(`slip S${tag} · .* by `) }); // the to-check list, not the cash book
  await row.getByRole("button", { name: "Different" }).click();
  await row.getByLabel("Amount on the bank statement").fill("4500");
  await row.getByLabel("Bank note").fill("Statement shows 4,500");
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toHaveCount(0); // this deposit has left the to-check list (others from other tests may still be there)

  await mgr.reload();
  expect(await bookTitle()).toBe(before - 4500); // the missing Rs 500 is back on the shop's book
  await expect(mgr.getByText("Deposit correction").first()).toBeVisible();
});
