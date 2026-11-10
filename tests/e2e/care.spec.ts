import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("a customer writes in; care replies; the customer answers; care resolves; a phone case is logged", async ({ browser }, info) => {
  const tag = `${Date.now() % 100000}-${info.retry}`;
  const phone = `98${String(Date.now()).slice(-8)}`;

  // a guest, no sign-in
  const guest = await (await browser.newContext()).newPage();
  await guest.goto("/help?topic=exchange#write");
  await guest.getByLabel("Your name").fill("Maya Gurung");
  await guest.getByLabel("Mobile number").fill(phone);
  await guest.getByLabel("In a few words").fill(`Wrong size ${tag}`);
  await guest.getByLabel("Tell us what happened").fill("I ordered M but got XL. Can I exchange it?");
  await guest.getByRole("button", { name: "Send", exact: true }).click();
  await expect(guest).toHaveURL(/\/help\/case\/[\w-]{24}$/);
  await expect(guest.getByRole("heading", { name: /Your request C-\d+/ })).toBeVisible();
  await expect(guest.getByText("Received")).toBeVisible();

  const owner = await (await browser.newContext()).newPage();
  await signIn(owner, "owner", `/admin/care?q=${phone}`);
  await owner.getByRole("link", { name: new RegExp(`Wrong size ${tag}`) }).click();
  await expect(owner.getByText("Size / exchange").first()).toBeVisible(); // ?topic=exchange chose the category
  await owner.getByLabel("Reply to customer").fill("Sorry Maya! A rider will swap it for M tomorrow, no charge.");
  await owner.getByRole("button", { name: "Send reply" }).click();
  await expect(owner.getByText("Waiting for customer").first()).toBeVisible();
  await owner.getByRole("button", { name: "Internal note" }).click();
  await owner.getByLabel("Internal note").fill(`Pathao pickup booked ${tag}`);
  await owner.getByRole("button", { name: "Add note" }).click();
  await expect(owner.getByText(`Pathao pickup booked ${tag}`)).toBeVisible();

  await guest.reload();
  await expect(guest.getByText("Waiting for your reply")).toBeVisible();
  await expect(guest.getByText("A rider will swap it for M tomorrow")).toBeVisible();
  await expect(guest.getByText(`Pathao pickup booked ${tag}`)).toHaveCount(0); // notes stay internal
  await guest.getByLabel("Reply or add more details").fill("Thank you! After 2pm please.");
  await guest.getByRole("button", { name: "Send reply" }).click();
  await expect(guest.getByText("Thank you! After 2pm please.")).toBeVisible();
  await expect(guest.getByText("We're on it")).toBeVisible();

  await owner.reload();
  await expect(owner.getByText("Thank you! After 2pm please.")).toBeVisible();
  await owner.getByLabel("Reply to customer").fill("Done: the rider has swapped it. Enjoy!");
  await owner.getByRole("button", { name: "Send and resolve" }).click();
  await expect(owner.getByText("Resolved").first()).toBeVisible();
  await guest.reload();
  await expect(guest.getByText("Resolved")).toBeVisible();

  // a phone call, logged by staff
  await owner.goto("/admin/care/new");
  await owner.getByLabel("Customer's name").fill("Ram Thapa");
  await owner.getByLabel("Customer's mobile").fill("9812345678");
  await owner.getByLabel("Subject").fill(`Refund not received ${tag}`);
  await owner.getByLabel("Category").selectOption("PAYMENT");
  await owner.getByLabel("What the customer said").fill("Returned a jacket two weeks ago, no refund yet.");
  await owner.getByRole("button", { name: "Log case" }).click();
  await expect(owner).toHaveURL(/\/admin\/care\/\d+$/);
  await expect(owner.getByText(/Phone · Payment \/ refund/)).toBeVisible();
  await expect(owner.getByLabel("Priority")).toHaveValue("URGENT"); // money problems are urgent by default
});
