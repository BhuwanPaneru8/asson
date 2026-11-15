import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { askResetHelp, identify, resetWithCode, sendCode, sendReset } from "@/actions/auth";
import { emailMode, maskEmail, whatsappMode } from "@/lib/password-reset";
import { maskPhone } from "@/lib/sign-in";
import { RedirectError } from "../support/next-mocks";
import { makeUser, resetDb } from "../support/db";

const redirected = async (p: Promise<unknown>) => { const e = await p.catch((x) => x); expect(e).toBeInstanceOf(RedirectError); return (e as RedirectError).url ?? (e as Error).message; };
const codeOf = (r: unknown) => (r as { testCode: string }).testCode;

describe("forgot password: a code by SMS, WhatsApp or email, or ask customer care", () => {
  beforeEach(async () => {
    await resetDb();
    await db.user.create({ data: { name: "Sita Rai", email: "sita@gmail.com", phone: "9841234567", passwordHash: await bcrypt.hash("Sita2026pass", 4) } });
    await db.user.create({ data: { name: "Hari", email: "9800000002@phone.asson.local", phone: "9800000002", passwordHash: "x" } });
  });
  afterEach(() => {
    for (const k of ["RESEND_API_KEY", "EMAIL_FROM", "WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_RESET_TEMPLATE"]) delete process.env[k];
    vi.unstubAllGlobals();
  });

  it("offers each way the account can get a code, masked; email only for real addresses", async () => {
    expect([emailMode(), whatsappMode()]).toEqual(["test", "test"]);
    expect(maskEmail("sita@gmail.com")).toBe("s***@gmail.com");
    expect(maskPhone("9841234567")).toBe("98******67");
    expect(await identify("sita@gmail.com")).toMatchObject({ ok: true, reset: { sms: "98******67", whatsapp: "98******67", email: "s***@gmail.com" } });
    expect(await identify("9800000002")).toMatchObject({ ok: true, reset: { sms: "98******02", whatsapp: "98******02" } });
    expect((await identify("9800000002") as { reset: object }).reset).not.toHaveProperty("email");
    expect(await sendReset({ identifier: "9800000002", via: "email" })).toMatchObject({ ok: false, error: expect.stringMatching(/can't send a code that way/) });
    expect(await sendReset({ identifier: "9811111111", via: "sms" })).toMatchObject({ ok: false, error: expect.stringMatching(/no account/) });
  });

  it("a code from any channel resets the password once and signs out every device; a newer code cancels the older", async () => {
    const first = await sendReset({ identifier: "sita@gmail.com", via: "email" });
    expect(first).toMatchObject({ ok: true, sentTo: "s***@gmail.com", testCode: expect.stringMatching(/^\d{6}$/) });
    const second = await sendReset({ identifier: "9841234567", via: "whatsapp" });
    expect(second).toMatchObject({ ok: true, sentTo: "98******67" });
    if (codeOf(first) !== codeOf(second)) expect(await resetWithCode({ identifier: "sita@gmail.com", code: codeOf(first), password: "Brandnew2026" })).toMatchObject({ ok: false });
    const before = (await db.user.findUniqueOrThrow({ where: { email: "sita@gmail.com" } })).tokenVersion;
    // asked for by email address, reset by mobile number: the code is for the account
    expect(await redirected(resetWithCode({ identifier: "9841234567", code: codeOf(second), password: "Brandnew2026" }))).toBe("/account");
    const u = await db.user.findUniqueOrThrow({ where: { email: "sita@gmail.com" } });
    expect(await bcrypt.compare("Brandnew2026", u.passwordHash)).toBe(true);
    expect(u.tokenVersion).toBe(before + 1);
    expect(await resetWithCode({ identifier: "9841234567", code: codeOf(second), password: "Again2026x" })).toMatchObject({ ok: false, error: expect.stringMatching(/expired/) });
    // the old sendCode route for SMS uses the same account code
    const sms = await sendCode({ identifier: "9841234567", purpose: "RESET" });
    expect(await redirected(resetWithCode({ identifier: "sita@gmail.com", code: codeOf(sms), password: "Third2026x" }))).toBe("/account");
    // 3 codes in 10 minutes across every channel, then wait
    expect(await sendReset({ identifier: "9841234567", via: "sms" })).toMatchObject({ ok: false, error: expect.stringMatching(/3 codes/) });
  });

  it("with email and WhatsApp connected it really sends, and never keeps the code in the message log", async () => {
    process.env.RESEND_API_KEY = "re_test"; process.env.EMAIL_FROM = "Asson <hello@asson.test>";
    process.env.WHATSAPP_TOKEN = "wa_test"; process.env.WHATSAPP_PHONE_NUMBER_ID = "123"; process.env.WHATSAPP_RESET_TEMPLATE = "asson_reset";
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes("resend") ? { id: "em_1" } : { messages: [{ id: "wamid.1" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await sendReset({ identifier: "9841234567", via: "email" })).toEqual({ ok: true, sentTo: "s***@gmail.com" }); // no code on screen
    const [emailUrl, emailInit] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const mail = JSON.parse(emailInit.body as string);
    expect(emailUrl).toContain("resend");
    expect(mail.to).toEqual(["sita@gmail.com"]);
    const code = /(\d{6}) is your code/.exec(mail.text)![1];

    expect(await sendReset({ identifier: "9841234567", via: "whatsapp" })).toEqual({ ok: true, sentTo: "98******67" });
    const [waUrl, waInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    const wa = JSON.parse(waInit.body as string);
    expect(waUrl).toBe("https://graph.facebook.com/v21.0/123/messages");
    expect(wa).toMatchObject({ to: "9779841234567", type: "template", template: { name: "asson_reset" } });
    const waCode = wa.template.components[0].parameters[0].text as string;
    expect(waCode).toMatch(/^\d{6}$/);

    const notes = await db.notification.findMany({ where: { template: "reset_code" }, orderBy: { createdAt: "asc" } });
    expect(notes.map((n) => [n.channel, n.status, n.providerRef])).toEqual([["EMAIL", "SENT", "em_1"], ["WHATSAPP", "SENT", "wamid.1"]]);
    for (const n of notes) expect(n.body).not.toMatch(/\d{6}/);
    // the email's code was replaced by the WhatsApp one
    if (code !== waCode) expect(await resetWithCode({ identifier: "9841234567", code, password: "Brandnew2026" })).toMatchObject({ ok: false });

    fetchMock.mockResolvedValueOnce(new Response("down", { status: 500 }));
    expect(await sendReset({ identifier: "9841234567", via: "email" })).toMatchObject({ ok: false, error: expect.stringMatching(/couldn't send/) });
    expect(await db.notification.count({ where: { template: "reset_code", status: "FAILED" } })).toBe(1);
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
    expect(await sendReset({ identifier: staff.email, via: "email" })).toMatchObject({ ok: false, error: expect.stringMatching(/Staff sign in/) });
    expect(await identify(staff.email)).toMatchObject({ ok: true, staff: true, reset: {} });
  });
});
