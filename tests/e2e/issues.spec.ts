import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

/** A real JPEG, drawn in the page's canvas (no fixture file needed). */
async function photo(page: Page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 900; c.height = 1200;
    const g = c.getContext("2d")!;
    g.fillStyle = "#8a5a44"; g.fillRect(0, 0, 900, 1200);
    g.fillStyle = "#fff"; g.font = "80px sans-serif"; g.fillText(`printer ${Math.random()}`, 40, 600);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  });
  return { name: "printer.jpg", mimeType: "image/jpeg", buffer: Buffer.from(b64, "base64") };
}

test("a cashier reports a broken printer with a photo; HQ assigns and resolves it; the shop sees each step", async ({ browser }, info) => {
  const tag = `${Date.now() % 100000}-${info.retry}`;
  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/issues");
  await cashier.getByLabel("Priority").selectOption("URGENT");
  await cashier.getByLabel("What's wrong").fill(`Receipt printer dead ${tag}`);
  await cashier.getByLabel("Details").fill("No paper feed since opening. Tried a new roll.");
  await cashier.getByLabel("Add photo").setInputFiles(await photo(cashier));
  await expect(cashier.getByRole("button", { name: "Remove photo" })).toBeVisible({ timeout: 15_000 });
  await cashier.getByRole("button", { name: "Send to HQ" }).click();
  await expect(cashier).toHaveURL(/\/admin\/issues\/\d+$/);
  await expect(cashier.getByRole("heading", { name: new RegExp(`ISS-\\d+ · Receipt printer dead ${tag}`) })).toBeVisible();
  await expect(cashier.getByRole("img", { name: "Issue photo" })).toBeVisible();
  const url = cashier.url();

  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/issues");
  await expect(owner.getByRole("link", { name: new RegExp(`Receipt printer dead ${tag}`) })).toBeVisible();
  await owner.goto(url);
  await owner.getByLabel("Status").selectOption("IN_PROGRESS");
  await owner.getByLabel("Who fixes it").selectOption({ label: "Ops Staff" });
  await owner.getByLabel("Update note").fill("Ops Staff brings a spare at 2pm");
  await owner.getByRole("button", { name: "Save" }).click();
  await expect(owner.getByText("Being fixed · Assigned to Ops Staff: Ops Staff brings a spare at 2pm")).toBeVisible();

  await owner.getByLabel("Status").selectOption("RESOLVED");
  await expect(owner.getByRole("button", { name: "Mark resolved" })).toBeDisabled(); // needs a note
  await owner.getByLabel("Repair cost (Rs.)").fill("1500");
  await owner.getByLabel("Update note").fill("Swapped in the spare printer");
  await owner.getByRole("button", { name: "Mark resolved" }).click();
  await expect(owner.getByText(/fixed \d/)).toBeVisible();

  await cashier.reload();
  await expect(cashier.getByText("Being handled by Ops Staff · repair cost Rs. 1,500")).toBeVisible();
  await expect(cashier.getByText(/Swapped in the spare printer/)).toBeVisible();
  await expect(cashier.getByRole("button", { name: "Still broken: reopen" })).toBeVisible();
});
