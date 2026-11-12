import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("the owner's dashboard leads with what needs attention, each item linking to where it's dealt with", async ({ page }) => {
  await signIn(page, "owner", "/admin");
  await expect(page.getByRole("heading", { name: /^Needs attention/ })).toBeVisible();
  const items = page.locator("ul li a").filter({ has: page.locator("span[aria-hidden]") });
  if (await items.count()) {
    const href = await items.first().getAttribute("href");
    await items.first().click();
    await expect(page).toHaveURL(new RegExp(href!.replace(/[?]/g, "\\?")));
  } else {
    await expect(page.getByText("Nothing needs you right now.")).toBeVisible();
  }
});
