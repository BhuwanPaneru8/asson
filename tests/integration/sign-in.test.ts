import { afterEach, beforeEach, describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { checkCode, codeMode, issueCode } from "@/lib/sign-in";
import { createAccount, identify, resetWithCode, sendCode, signInWithCode, signInWithPassword } from "@/actions/auth";
import { customerResetLink } from "@/actions/admin/team";
import { redeemResetLink, resetFor, addTeamMember, inviteFor } from "@/lib/team";
import { RedirectError } from "../support/next-mocks";
import { actAs, makeLocation, makeUser, resetDb } from "../support/db";

const redirected = async (p: Promise<unknown>) => { const e = await p.catch((x) => x); expect(e).toBeInstanceOf(RedirectError); return (e as RedirectError).url ?? (e as Error).message; };
const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);

describe("sign-in", () => {
  beforeEach(async () => {
    await resetDb();
    process.env.AUTH_CODES_TEST = "1";
    await db.user.create({ data: { name: "Sita Rai", email: "sita@test.local", phone: "9841234567", passwordHash: await bcrypt.hash("Sita2026pass", 4) } });
  });
  afterEach(() => { delete process.env.AUTH_CODES_TEST; });

  it("identifies by mobile or email, and says what the person can do", async () => {
    expect(await identify("+977 984-1234567")).toMatchObject({ ok: true, kind: "phone", exists: true, firstName: "Sita", codes: true, staff: false });
    expect(await identify("SITA@test.local")).toMatchObject({ ok: true, kind: "email", exists: true, codes: false });
    expect(await identify("9800000000")).toMatchObject({ ok: true, exists: false, codes: true });
    expect(await identify("nonsense")).toMatchObject({ ok: false });
    await db.user.create({ data: { name: "Twin", email: "twin@test.local", phone: "9841234567", passwordHash: "x" } });
    expect(await identify("9841234567")).toMatchObject({ ok: false, error: expect.stringMatching(/More than one account/) });
  });

  it("signs in with a password by phone or email; a wrong one says so", async () => {
    expect(await signInWithPassword({ identifier: "9841234567", password: "nope" })).toMatchObject({ ok: false, error: expect.stringMatching(/isn't right/) });
    expect(await redirected(signInWithPassword({ identifier: "9841234567", password: "Sita2026pass", next: "/account/orders" }))).toMatch(/\/account\/orders/);
    expect(await redirected(signInWithPassword({ identifier: "sita@test.local", password: "Sita2026pass" }))).toMatch(/\/account/);
  });

  it("one-time codes: right once, 5 tries, expire, at most 3 per 10 minutes", async () => {
    expect(codeMode()).toBe("test");
    const { testCode } = await issueCode("9841234567", "LOGIN");
    expect(testCode).toMatch(/^\d{6}$/);
    await expect(checkCode("9841234567", "LOGIN", "000000" === testCode ? "111111" : "000000")).rejects.toThrow(/isn't right/);
    expect(await checkCode("9841234567", "LOGIN", testCode!)).toBe(true);
    await expect(checkCode("9841234567", "LOGIN", testCode!)).rejects.toThrow(/expired/); // used up
    await issueCode("9841234567", "LOGIN");
    await issueCode("9841234567", "LOGIN");
    await expect(issueCode("9841234567", "LOGIN")).rejects.toThrow(/3 codes/);
    const later = new Date(Date.now() + 11 * 60_000);
    await expect(checkCode("9841234567", "LOGIN", "123456", later)).rejects.toThrow(/expired/);
  });

  it("five wrong tries and the code stops working", async () => {
    const { testCode } = await issueCode("9800000001", "LOGIN");
    const wrong = testCode === "999999" ? "888888" : "999999";
    for (let i = 0; i < 5; i++) await checkCode("9800000001", "LOGIN", wrong).catch(() => {});
    await expect(checkCode("9800000001", "LOGIN", testCode!)).rejects.toThrow(/Too many wrong tries/);
  });

  it("a new number signs up with just a code (welcome points), an existing one signs in", async () => {
    const r = await sendCode({ identifier: "9800000002", purpose: "LOGIN" });
    expect(r).toMatchObject({ ok: true, testCode: expect.stringMatching(/^\d{6}$/) });
    await redirected(signInWithCode({ identifier: "9800000002", code: (r as { testCode: string }).testCode, name: "Hari Lal" }));
    const u = await db.user.findFirstOrThrow({ where: { phone: "9800000002" } });
    expect(u).toMatchObject({ name: "Hari Lal", role: "CUSTOMER", points: 100 });
  });

  it("creates an account with a password; won't duplicate an email or number", async () => {
    await redirected(createAccount({ identifier: "new@test.local", name: "New Person", phone: "9800000003", password: "Newpass2026" }));
    expect(await db.user.findUniqueOrThrow({ where: { email: "new@test.local" } })).toMatchObject({ phone: "9800000003" });
    expect(await createAccount({ identifier: "9841234567", name: "Again", email: "other@test.local", password: "Newpass2026" })).toMatchObject({ ok: false, fieldErrors: { phone: expect.stringMatching(/already exists/) } });
    expect(await createAccount({ identifier: "x@test.local", name: "X", password: "short" })).toMatchObject({ ok: false });
  });

  it("forgot password by SMS code: new password, everywhere else signed out", async () => {
    const before = (await db.user.findUniqueOrThrow({ where: { email: "sita@test.local" } })).tokenVersion;
    const r = await sendCode({ identifier: "9841234567", purpose: "RESET" });
    await redirected(resetWithCode({ identifier: "9841234567", code: (r as { testCode: string }).testCode, password: "Brandnew2026" }));
    const u = await db.user.findUniqueOrThrow({ where: { email: "sita@test.local" } });
    expect(await bcrypt.compare("Brandnew2026", u.passwordHash)).toBe(true);
    expect(u.tokenVersion).toBe(before + 1);
  });

  it("two doors: staff sign in only at /admin/login, shoppers only on the shop", async () => {
    const staff = await makeUser("CASHIER");
    // the shop turns staff away, without even checking the password
    expect(await signInWithPassword({ identifier: staff.email, password: "Password1" })).toMatchObject({ ok: false, error: expect.stringMatching(/staff page/) });
    // the staff page signs staff in and sends them to their staff home
    expect(await redirected(signInWithPassword({ identifier: staff.email, password: "Password1", area: "staff" }))).toMatch(/\/admin/);
    // a shopper's right password still doesn't open the staff page, and the answer doesn't reveal the account
    const shopper = await signInWithPassword({ identifier: "sita@test.local", password: "Sita2026pass", area: "staff" });
    const nobody = await signInWithPassword({ identifier: "nobody@test.local", password: "Sita2026pass", area: "staff" });
    expect(shopper).toMatchObject({ ok: false, error: expect.stringMatching(/staff account/) });
    expect(nobody).toEqual(shopper);
  });

  it("staff can't use codes (every staff sign-in is with their password and recorded)", async () => {
    const staff = await makeUser("CASHIER");
    await db.user.update({ where: { id: staff.id }, data: { phone: "9800000009" } });
    expect(await identify("9800000009")).toMatchObject({ ok: true, staff: true, codes: false });
    expect(await sendCode({ identifier: "9800000009", purpose: "LOGIN" })).toMatchObject({ ok: false, error: expect.stringMatching(/Staff sign in/) });
  });

  it("customer care's reset link: once, 24 hours, customers only; invite and reset links never stand in for each other", async () => {
    const care = await makeUser("STAFF");
    await db.user.update({ where: { id: care.id }, data: { job: "care" } }); // the Customer care job can see customers
    actAs(care);
    const sita = await db.user.findUniqueOrThrow({ where: { email: "sita@test.local" } });
    const r = await customerResetLink(sita.id);
    if (!r.ok) throw new Error(r.error);
    const token = r.link.split("/reset/")[1];
    expect(await resetFor(token)).toMatchObject({ name: "Sita Rai" });
    expect(await inviteFor(token)).toBeNull(); // a reset link isn't a staff invite
    await tx((t) => redeemResetLink(t, token, "Carefix2026"));
    expect(await resetFor(token)).toBeNull();
    expect(await db.auditLog.count({ where: { action: "customer.reset_link" } })).toBe(1);
    expect(await customerResetLink(care.id)).toMatchObject({ ok: false, error: expect.stringMatching(/Team & access/) });

    const owner = await makeUser("ADMIN");
    const shop = await makeLocation({ code: "KTM" });
    const inv = await tx((t) => addTeamMember(t, owner, { name: "New Staff", email: "ns@test.local", job: "cashier", storeIds: [shop.id], all: false }));
    expect(await resetFor(inv.token)).toBeNull(); // a staff invite isn't a reset link
  });
});
