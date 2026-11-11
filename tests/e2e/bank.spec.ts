import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner imports a bank statement: the shop's deposit is ticked off automatically, an interest credit is explained", async ({ browser }, info) => {
  const tag = `${Date.now() % 1_000_000}${info.retry}`;
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kathmandu", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date()); // DD/MM/YYYY
  const amount = 3000 + (Number(tag) % 900); // unique enough that an earlier run's deposit can't tie with it

  const mgr = await (await browser.newContext()).newPage();
  await signIn(mgr, "manager", "/admin/cash");
  await mgr.getByRole("link", { name: "Asson Flagship" }).first().click();
  if (!(await mgr.getByRole("heading", { name: "Record a bank deposit" }).count())) {
    await mgr.getByLabel("Cash counted").fill("20000");
    await mgr.getByRole("button", { name: "Save count" }).click();
    await expect(mgr.getByRole("heading", { name: "Record a bank deposit" })).toBeVisible();
  }
  const book = Number((await mgr.getByRole("heading", { name: /^Cash book · / }).innerText()).replace(/[^\d]/g, ""));
  if (book < amount) { // top the safe up through a count so the deposit fits
    await mgr.getByLabel("Cash counted").fill(String(book + amount));
    await mgr.getByLabel("Count note").fill("Test top-up");
    await mgr.getByRole("button", { name: "Save count" }).click();
    await expect(mgr.getByRole("heading", { name: /^Cash book · / })).toHaveText(new RegExp((book + amount).toLocaleString("en-IN")));
  }
  await mgr.getByLabel("Deposit amount").fill(String(amount));
  await mgr.getByLabel("Bank").fill("NIC Asia");
  await mgr.getByLabel("Slip number").fill(`B${tag}`);
  await mgr.getByRole("button", { name: "Record deposit" }).click();
  await expect(mgr.getByText(`NIC Asia slip B${tag}`).first()).toBeVisible();

  const csv = `Txn Date,Description,Cheque No,Withdraw,Deposit,Balance\n${today},CASH DEP FLAGSHIP SLIP B${tag},,,"${amount.toLocaleString("en-IN")}.00",\n${today},INTEREST ${tag},,,"12.${String(tag).slice(-2).padStart(2, "0")}",\n`;
  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/finance/bank");
  await owner.getByLabel("Bank account").fill("NIC Asia current");
  await owner.getByLabel("Statement file").setInputFiles({ name: "statement.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  await expect(owner.getByText(/2 transactions/)).toBeVisible();
  await owner.getByRole("button", { name: "Import and match" }).click();
  await expect(owner.getByText(/2 new line\(s\) · 1 deposit\(s\)/)).toBeVisible();

  const interest = owner.getByRole("listitem").filter({ hasText: `INTEREST ${tag}` });
  await interest.getByLabel("Explain this line").selectOption("ignore");
  await interest.getByLabel("What this money is").fill("Interest");
  await interest.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByRole("listitem").filter({ hasText: `INTEREST ${tag}` }).getByLabel("Explain this line")).toHaveCount(0);

  await mgr.reload();
  await expect(mgr.getByText(/on statement/).first()).toBeVisible(); // the deposit shows as checked on the shop's page
});
