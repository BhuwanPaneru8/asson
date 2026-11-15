import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { askResetHelp, emailReset, identify } from "@/actions/auth";
import { emailMode, maskEmail } from "@/lib/password-reset";
import { redeemResetLink } from "@/lib/team";
import { makeUser, resetDb } from "../support/db";

const tx = <T,>(f: (t: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => Promise<T>) => db.$transaction(f);
const tokenOf = (link: string) => link.split("/reset/")[1];

describe("forgot password without SMS: email link, or ask customer care", () => {
  beforeEach(async () => {
    await resetDb();
    await db.user.create({ data: { name: "Sita Rai", email: "sita@gmail.com", phone: "9841234567", passwordHash: await bcrypt.hash("Sita2026pass", 4) } });
    await db.user.create({ data: { name: "Hari", email: "9800000002@phone.asson.local", phone: "9800000002", passwordHash: "x" } });
  });
  afterEach(() => { delete process.env.RESEND_API_KEY; delete process.env.EMAIL_FROM; vi.unstubAllGlobals(); });

  it("offers an email link when the account has a real address (masked), never for phone-only accounts", async () => {
    expect(emailMode()).toBe("test");
    expect(maskEmail("sita@gmail.com")).toBe("s***@gmail.com");
    expect(await identify("9841234567")).toMatchObject({ ok: true, resetEmail: "s***@gmail.com" });
    expect(await identify("9800000002")).toMatchObject({ ok: true, resetEmail: null });
    expect(await emailReset({ identifier: "9800000002" })).toMatchObject({ ok: false, error: expect.stringMatching(/isn't available/) });
    expect(await emailReset({ identifier: "9811111111" })).toMatchObject({ ok: false, error: expect.stringMatching(/no account/) });
  });

  it("the link works once; a newer link cancels the older; 3 an hour at most", async () => {
    const first = await emailReset({ identifier: "sita@gmail.com" });
    const second = await emailReset({ identifier: "9841234567" });
    if (!first.ok || !second.ok) throw new Error("expected links");
    expect(second.sentTo).toBe("s***@gmail.com");
    await expect(tx((t) => redeemResetLink(t, tokenOf(first.testLink!), "Brandnew2026"))).rejects.toThrow(/expired|used/);
    const before = (await db.user.findUniqueOrThrow({ where: { email: "sita@gmail.com" } })).tokenVersion;
    await tx((t) => redeemResetLink(t, tokenOf(second.testLink!), "Brandnew2026"));
    const u = await db.user.findUniqueOrThrow({ where: { email: "sita@gmail.com" } });
    expect(await bcrypt.compare("Brandnew2026", u.passwordHash)).toBe(true);
    expect(u.tokenVersion).toBe(before + 1); // every other device signed out
    await expect(tx((t) => redeemResetLink(t, tokenOf(second.testLink!), "Again2026x"))).rejects.toThrow(/expired|used/);
    await emailReset({ identifier: "sita@gmail.com" });
    expect(await emailReset({ identifier: "sita@gmail.com" })).toMatchObject({ ok: false, error: expect.stringMatching(/3 reset links/) });
  });

  it("with an email service connected it really sends, and never keeps the link in the message log", async () => {
    process.env.RESEND_API_KEY = "re_test"; process.env.EMAIL_FROM = "Asson <hello@asson.test>";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "em_1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await emailReset({ identifier: "9841234567" });
    expect(r).toEqual({ ok: true, sentTo: "s***@gmail.com" }); // no link on screen
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(sent.to).toEqual(["sita@gmail.com"]);
    expect(sent.text).toMatch(/\/reset\/[A-Za-z0-9_-]{20,}/);
    const n = await db.notification.findFirstOrThrow({ where: { template: "reset_link" } });
    expect(n).toMatchObject({ channel: "EMAIL", status: "SENT", providerRef: "em_1" });
    expect(n.body).not.toMatch(/\/reset\/[A-Za-z0-9_-]{5,}/);

    fetchMock.mockResolvedValueOnce(new Response("down", { status: 500 }));
    expect(await emailReset({ identifier: "9841234567" })).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't send/) });
  });

  it("asks customer care once (a second tap joins the open request); staff are sent to the owner", async () => {
    const a = await askResetHelp({ identifier: "9800000002" });
    expect(a).toMatchObject({ ok: true, already: false });
    const b = await askResetHelp({ identifier: "9800000002" });
    expect(b).toMatchObject({ ok: true, already: true, caseNumber: (a as { caseNumber: number }).caseNumber });
    const c = await db.careCase.findFirstOrThrow({ where: { subject: "Password reset request" } });
    expect(c).toMatchObject({ phone: "9800000002", email: null, status: "NEW" });

    const staff = await makeUser("CASHIER");
    expect(await askResetHelp({ identifier: staff.email })).toMatchObject({ ok: false, error: expect.stringMatching(/Staff sign in/) });
    expect(await emailReset({ identifier: staff.email })).toMatchObject({ ok: false, error: expect.stringMatching(/Staff sign in/) });
    expect(await identify(staff.email)).toMatchObject({ ok: true, staff: true, resetEmail: null });
  });
});
