import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("owner makes shirts: fabric in, bill of materials, production order, issue, delivery into stock", async ({ page }) => {
  await signIn(page, "owner", "/admin/production/materials");

  // a fabric, received with the mill's invoice
  await page.getByLabel("Code", { exact: true }).fill("FAB-OXF-SKY");
  await page.getByLabel("Name", { exact: true }).fill("Sky oxford cotton");
  await page.getByLabel("Unit", { exact: true }).fill("m");
  await page.getByRole("button", { name: "Add material" }).click();
  await expect(page.getByRole("cell", { name: /Sky oxford cotton/ })).toBeVisible();
  await page.getByLabel("Quantity (m)").fill("100");
  await page.getByLabel("Cost per m, Rs. (before VAT)").fill("400");
  await page.getByLabel("Their invoice no. (records the bill)").fill("MILL-77");
  await page.getByLabel(/^Supplier/).selectOption({ index: 1 });
  await page.getByRole("button", { name: "Receive" }).click();
  await expect(page.getByRole("cell", { name: "100 m" })).toBeVisible();

  // what one shirt uses
  await page.goto("/admin/production/products?q=Oxford");
  await page.getByRole("link", { name: /Oxford Button-Down Shirt/ }).click();
  await page.getByLabel("Add a material").selectOption({ label: "Sky oxford cotton (FAB-OXF-SKY)" });
  await page.getByLabel("Sky oxford cotton per piece").fill("1.6");
  await page.getByLabel("Workshop stitching charge per piece, Rs.").fill("150");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Saved")).toBeVisible();

  // plan 10 shirts, issue the fabric, receive the first delivery
  await page.getByRole("link", { name: "Make this" }).click();
  await page.getByLabel("Sky Blue S pieces").fill("6");
  await page.getByLabel("Sky Blue M pieces").fill("4");
  await expect(page.getByText(/16\.48 m of 100 m/)).toBeVisible(); // 1.6 × 10 × 1.03
  await page.getByRole("button", { name: "Create draft for 10 pieces" }).click();
  await expect(page).toHaveURL(/\/admin\/production\/[^/]+$/);
  await expect(page.getByRole("heading", { name: /PRD-\d{5} · Oxford Button-Down Shirt/ })).toBeVisible();

  await page.getByRole("button", { name: "Issue materials to the workshop" }).click();
  await expect(page.getByText("Receive pieces from the workshop")).toBeVisible();
  await expect(page.getByText(/Issued · Sky oxford cotton/)).toBeVisible();

  await page.getByLabel("Sky Blue · S good").fill("5");
  await page.getByLabel("Sky Blue · S rejected").fill("1");
  await page.getByRole("button", { name: "Receive into stock" }).click();
  await expect(page.getByText(/PR-\d+ · 5 good, 1 rejected/)).toBeVisible();
  await expect(page.getByText("5 of 10")).toBeVisible();
  await expect(page.getByText(/Workshop billed Rs\. 750/)).toBeVisible();
});
