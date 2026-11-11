import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function photo(page: Page, label: string) {
  const b64 = await page.evaluate((text) => {
    const c = document.createElement("canvas");
    c.width = 900; c.height = 1200;
    const g = c.getContext("2d")!;
    g.fillStyle = `hsl(${Math.floor(Math.random() * 360)} 60% 40%)`; g.fillRect(0, 0, 900, 1200);
    g.fillStyle = "#fff"; g.font = "70px sans-serif"; g.fillText(`${text} ${Math.random()}`, 30, 600);
    return c.toDataURL("image/jpeg", 0.9).split(",")[1];
  }, label);
  return { name: `${label}.jpg`, mimeType: "image/jpeg", buffer: Buffer.from(b64, "base64") };
}

async function sendShots(page: Page) {
  for (const shot of ["Window", "Entrance table"]) {
    await page.getByLabel(`Photo of ${shot}`).setInputFiles(await photo(page, shot));
  }
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(2, { timeout: 20_000 });
}

test("HQ sends a display brief; the shop sends photos; HQ asks for a redo, then approves with a score", async ({ browser }, info) => {
  const tag = `${Date.now() % 100000}-${info.retry}`;
  const due = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);

  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", "/admin/vm");
  await owner.getByLabel("Brief title").fill(`Dashain window ${tag}`);
  await owner.getByLabel("Instructions").fill("Red and gold. Kurtas front left, price tags facing out.");
  await owner.getByRole("button", { name: "Asson Flagship" }).click();
  await owner.getByLabel("Due date").fill(due);
  await owner.getByRole("button", { name: "Send brief" }).click();
  await expect(owner).toHaveURL(/\/admin\/vm\/\d+$/);
  const url = owner.url();

  const cashier = await (await browser.newContext()).newPage();
  await signIn(cashier, "cashier", "/admin/today");
  const flagship = cashier.getByRole("link", { name: "Asson Flagship", exact: true });
  if (await flagship.count()) await flagship.click();
  await cashier.getByRole("link", { name: new RegExp(`Dashain window ${tag}`) }).click();
  await sendShots(cashier);
  await cashier.getByRole("button", { name: "Send photos" }).click();
  await expect(cashier.getByText(/Asson Flagship · Waiting for review/)).toBeVisible();

  await owner.goto(url);
  await owner.getByLabel("Feedback").fill("Price tags are hidden behind the dupatta. Turn them out.");
  await owner.getByRole("button", { name: "Ask for a redo" }).click();
  await expect(owner.getByText(/Asson Flagship · Redo asked/)).toBeVisible();

  await cashier.reload();
  await expect(cashier.getByText("Price tags are hidden behind the dupatta. Turn them out.").first()).toBeVisible();
  await sendShots(cashier);
  await cashier.getByRole("button", { name: "Send again" }).click();
  // "Waiting for review" is already in round 1's history: wait for round 2 itself before HQ looks
  await expect(cashier.getByText("round 2")).toBeVisible();

  await owner.reload();
  await expect(owner.getByText("round 2")).toBeVisible();
  for (const [point, score] of [["Colours and styling match the reference", "2"], ["Price tags visible and correct", "2"], ["Clean, lit, nothing missing", "1"]]) {
    await owner.getByRole("radiogroup", { name: point }).getByRole("radio", { name: score }).click();
  }
  await owner.getByRole("button", { name: "Approve" }).click();
  await expect(owner.getByText(/Asson Flagship · Approved · 83%/)).toBeVisible();
  await owner.goto("/admin/vm");
  await expect(owner.getByRole("row", { name: /Asson Flagship/ })).toBeVisible();
});
