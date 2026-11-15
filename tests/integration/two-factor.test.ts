import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { signInWithPassword, changePassword } from "@/actions/auth";
import { beginTotpSetup, finishTotpSetup, newBackupCodes, requireMemberTwoFactor, resetMemberTwoFactor, sendTwoFactorSms, turnOffTwoFactor, verifyTwoFactor } from "@/actions/two-factor";
import { setPasswordFromInvite } from "@/actions/invite";
import { addTeamMember } from "@/lib/team";
import { TWO_FACTOR_LIMITS, trustCookieName } from "@/lib/two-factor";
import { decryptSecret, totpAt, totpStep } from "@/lib/two-factor-core";
import { PENDING_COOKIE, SESSION_COOKIE, signSession, verifyPending } from "@/lib/session-token";
import { RedirectError, session } from "../support/next-mocks";
import { actAs, makeUser, resetDb } from "../support/db";

const redirected = async (p: Promise<unknown>) => { const e = await p.catch((x) => x); expect(e).toBeInstanceOf(RedirectError); return (e as RedirectError).url; };
const actions = async (userId: string) => (await db.auditLog.findMany({ where: { entityId: userId }, orderBy: { at: "asc" } })).map((r) => r.action);
const sessionMock = vi.mocked(createSession);

/** A staff member with password "Password1" (lib makeUser). */
async function staff(role: "ADMIN" | "MANAGER" | "CASHIER", phone?: string) {
  const u = await makeUser(role);
  if (phone) await db.user.update({ where: { id: u.id }, data: { phone } });
  return u;
}
const password = (u: { email: string }, next?: string) => signInWithPassword({ identifier: u.email, password: "Password1", next });

/** Sign in with the password, set up the app, and keep the secret (as a person would after scanning). */
async function setUp(u: { email: string; id: string }) {
  expect(await redirected(password(u))).toBe("/login/two-factor");
  const s = await beginTotpSetup();
  if (!s.ok) throw new Error(s.error);
  const r = await finishTotpSetup({ code: totpAt(s.secret, totpStep()) });
  if (!r.ok) throw new Error(r.error);
  session.cookies.clear();
  return { secret: s.secret.replace(/ /g, ""), codes: r.codes };
}

describe("two-step sign-in", () => {
  beforeEach(async () => { await resetDb(); sessionMock.mockClear(); vi.useRealTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it("a manager who hasn't set it up goes to set-up straight after the password, before any session", async () => {
    const m = await staff("MANAGER");
    expect(await redirected(password(m, "/admin/orders"))).toBe("/login/two-factor");
    expect(sessionMock).not.toHaveBeenCalled();
    const pending = await verifyPending(session.cookies.get(PENDING_COOKIE));
    expect(pending).toMatchObject({ sub: m.id, stage: "setup", next: "/admin/orders" });
    // the pending token is not a session (different key and audience)
    expect(session.cookies.get(SESSION_COOKIE)).toBeUndefined();
    // and can't be used to verify a code: there's nothing to verify yet
    expect(await verifyTwoFactor({ method: "totp", code: "123456" })).toMatchObject({ ok: false, error: expect.stringMatching(/timed out/) });

    const s = await beginTotpSetup();
    if (!s.ok) throw new Error(s.error);
    expect((await beginTotpSetup() as { secret: string }).secret).toBe(s.secret); // a reload shows the same QR code
    expect(s.uri).toMatch(/^otpauth:\/\/totp\/Asson%3A/);
    expect(s.qr.cells).toMatch(/^[01]+$/);
    expect(s.qr.cells.length).toBe(s.qr.size ** 2);
    expect(await finishTotpSetup({ code: "000000" })).toMatchObject({ ok: false, error: expect.stringMatching(/isn't right/) });

    const r = await finishTotpSetup({ code: totpAt(s.secret, totpStep()) });
    expect(r).toMatchObject({ ok: true, next: "/admin/orders" });
    if (!r.ok) return;
    expect(r.codes).toHaveLength(10);
    expect(sessionMock).toHaveBeenCalledWith(expect.objectContaining({ id: m.id }), { remember: true, twoFactor: true });
    expect(session.cookies.has(PENDING_COOKIE)).toBe(false);

    // stored encrypted; backup codes only as hashes
    const row = await db.user.findUniqueOrThrow({ where: { id: m.id }, include: { backupCodes: true } });
    expect(row.totpSecret).not.toContain(s.secret.replace(/ /g, ""));
    expect(decryptSecret(row.totpSecret!)).toBe(s.secret.replace(/ /g, ""));
    expect(row.totpPendingSecret).toBeNull();
    expect(row.backupCodes).toHaveLength(10);
    expect(row.backupCodes.some((b) => r.codes.some((c) => b.codeHash.includes(c.replace("-", ""))))).toBe(false);
    expect(await actions(m.id)).toEqual(["auth.2fa_failed", "auth.2fa_enabled", "auth.login"]);
  });

  it("then asks for a code at every sign-in; wrong codes are recorded, a code works once", async () => {
    const m = await staff("MANAGER");
    const { secret } = await setUp(m);
    sessionMock.mockClear();
    expect(await redirected(password(m, "/admin/cash"))).toBe("/login/two-factor");
    expect((await verifyPending(session.cookies.get(PENDING_COOKIE)))?.stage).toBe("verify");
    expect(sessionMock).not.toHaveBeenCalled();

    expect(await verifyTwoFactor({ method: "totp", code: "000000" })).toMatchObject({ ok: false, error: expect.stringMatching(/isn't right/) });
    // the set-up's code was this step: using it again is refused
    expect(await verifyTwoFactor({ method: "totp", code: totpAt(secret, totpStep()) })).toMatchObject({ ok: false, error: expect.stringMatching(/just used/) });
    expect(await redirected(verifyTwoFactor({ method: "totp", code: totpAt(secret, totpStep() + 1) }))).toBe("/admin/cash");
    expect(sessionMock).toHaveBeenCalledWith(expect.objectContaining({ id: m.id }), { remember: true, twoFactor: true });
    expect(session.cookies.has(PENDING_COOKIE)).toBe(false);
    expect(session.cookies.has(trustCookieName(m.id))).toBe(false);
    const audit = await db.auditLog.findMany({ where: { entityId: m.id, action: { in: ["auth.2fa_failed", "auth.login"] } }, orderBy: { at: "asc" } });
    expect(audit.map((a) => a.action)).toEqual(["auth.login", "auth.2fa_failed", "auth.2fa_failed", "auth.login"]);
    expect(audit[1].summary).toMatch(/Wrong authenticator app for staff account/);
    expect(audit[3].summary).toMatch(/two-step: authenticator app/);
    // the pending step is gone: a second try with it does nothing
    expect(await verifyTwoFactor({ method: "totp", code: totpAt(secret, totpStep() + 1) })).toMatchObject({ ok: false });
  });

  it("a trusted device skips the code for 30 days, until access is revoked", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T06:00:00Z") });
    const m = await staff("MANAGER");
    const { secret } = await setUp(m);
    await redirected(password(m));
    await redirected(verifyTwoFactor({ method: "totp", code: totpAt(secret, totpStep() + 1), trust: true }));
    const trust = session.cookies.get(trustCookieName(m.id));
    expect(trust).toBeTruthy();

    // next sign-in on this browser: password only
    session.cookies.clear(); session.cookies.set(trustCookieName(m.id), trust!);
    sessionMock.mockClear();
    expect(await redirected(password(m))).toBe("/admin");
    expect(sessionMock).toHaveBeenCalledWith(expect.objectContaining({ id: m.id }), { remember: true, twoFactor: true });
    expect((await db.auditLog.findFirstOrThrow({ where: { entityId: m.id, action: "auth.login" }, orderBy: { at: "desc" } })).summary).toMatch(/trusted device/);

    // someone else's trust cookie, or one for another person, doesn't help
    const other = await staff("MANAGER");
    await setUp(other);
    session.cookies.clear(); session.cookies.set(trustCookieName(other.id), trust!);
    expect(await redirected(password(other))).toBe("/login/two-factor");

    // a password change (or removal, or a 2FA reset) bumps tokenVersion: the device is no longer trusted
    await db.user.update({ where: { id: m.id }, data: { tokenVersion: { increment: 1 } } });
    session.cookies.clear(); session.cookies.set(trustCookieName(m.id), trust!);
    expect(await redirected(password(m))).toBe("/login/two-factor");

    // and it runs out after 30 days
    await db.user.update({ where: { id: m.id }, data: { tokenVersion: { decrement: 1 } } });
    vi.setSystemTime(new Date("2026-12-16T06:00:00Z"));
    session.cookies.clear(); session.cookies.set(trustCookieName(m.id), trust!);
    expect(await redirected(password(m))).toBe("/login/two-factor");
  });

  it("backup codes sign in once each", async () => {
    const m = await staff("ADMIN");
    const { codes } = await setUp(m);
    await redirected(password(m));
    expect(await redirected(verifyTwoFactor({ method: "backup", code: codes[0].toUpperCase().replace("-", " ") }))).toBe("/admin");
    await redirected(password(m));
    expect(await verifyTwoFactor({ method: "backup", code: codes[0] })).toMatchObject({ ok: false, error: expect.stringMatching(/already used/) });
    expect(await verifyTwoFactor({ method: "backup", code: "aaaaa-bbbbb" })).toMatchObject({ ok: false });
    expect((await db.auditLog.findFirstOrThrow({ where: { entityId: m.id, action: "auth.2fa_backup_used" } })).summary).toMatch(/9 left/);
  });

  it("is rate-limited like passwords, and blocking is recorded", async () => {
    const m = await staff("MANAGER");
    const { secret } = await setUp(m);
    await redirected(password(m));
    // the test's network address changes on every request, so the per-person limit is what stops it
    for (let i = 0; i < TWO_FACTOR_LIMITS.perPerson - 1; i++) expect((await verifyTwoFactor({ method: "totp", code: "000000" })).ok).toBe(false); // setUp used one try
    const blocked = await verifyTwoFactor({ method: "totp", code: totpAt(secret, totpStep() + 1) });
    expect(blocked).toMatchObject({ ok: false, error: expect.stringMatching(/Too many tries/) });
    await expect(verifyTwoFactor({ method: "backup", code: "aaaaa-bbbbb" })).resolves.toMatchObject({ error: expect.stringMatching(/Too many tries/) });
    expect(await db.auditLog.count({ where: { entityId: m.id, action: "auth.2fa_blocked" } })).toBe(2);
    expect(await db.auditLog.count({ where: { entityId: m.id, action: "auth.2fa_failed" } })).toBe(TWO_FACTOR_LIMITS.perPerson - 1);
  });

  it("falls back to a text message code when SMS codes work", async () => {
    process.env.AUTH_CODES_TEST = "1";
    try {
      const m = await staff("MANAGER", "9841000001");
      await setUp(m);
      await redirected(password(m));
      const sent = await sendTwoFactorSms();
      if (!sent.ok || !sent.testCode) throw new Error("no code");
      expect(await verifyTwoFactor({ method: "sms", code: sent.testCode === "000000" ? "111111" : "000000" })).toMatchObject({ ok: false });
      expect(await redirected(verifyTwoFactor({ method: "sms", code: sent.testCode }))).toBe("/admin");
      expect((await db.auditLog.findFirstOrThrow({ where: { entityId: m.id, action: "auth.login" }, orderBy: { at: "desc" } })).summary).toMatch(/text message code/);
      // no phone, no SMS
      const n = await staff("MANAGER");
      await setUp(n);
      await redirected(password(n));
      expect(await sendTwoFactorSms()).toMatchObject({ ok: false });
    } finally {
      delete process.env.AUTH_CODES_TEST;
    }
  });

  it("cashiers sign in with their password, unless the owner requires it (then set-up comes first)", async () => {
    const owner = await staff("ADMIN");
    const c = await staff("CASHIER");
    expect(await redirected(password(c))).toBe("/admin/pos");
    expect(sessionMock).toHaveBeenLastCalledWith(expect.objectContaining({ id: c.id }), { remember: true });

    actAs(owner);
    expect(await requireMemberTwoFactor({ userId: c.id, required: true })).toEqual({ ok: true });
    expect(await requireMemberTwoFactor({ userId: owner.id, required: false })).toMatchObject({ ok: false, error: expect.stringMatching(/always need/) });
    actAs(null);
    expect(await redirected(password(c))).toBe("/login/two-factor");
    expect((await verifyPending(session.cookies.get(PENDING_COOKIE)))?.stage).toBe("setup");
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "team.2fa_required" } })).summary).toMatch(/now required/);
  });

  it("an existing session stops counting once two-step sign-in is needed (the real getCurrentUser)", async () => {
    const real = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
    const c = await staff("CASHIER");
    const row = await db.user.findUniqueOrThrow({ where: { id: c.id } });
    session.cookies.set(SESSION_COOKIE, await signSession({ sub: c.id, role: "CASHIER", v: row.tokenVersion }));
    expect((await real.getCurrentUser())?.id).toBe(c.id);
    await db.user.update({ where: { id: c.id }, data: { twoFactorRequired: true } });
    expect(await real.getCurrentUser()).toBeNull(); // signed out on the next click
    session.cookies.set(SESSION_COOKIE, await signSession({ sub: c.id, role: "CASHIER", v: row.tokenVersion, m: 1 }));
    expect((await real.getCurrentUser())?.id).toBe(c.id);
    // a customer's session never needs it
    const shopper = await makeUser("CUSTOMER");
    session.cookies.set(SESSION_COOKIE, await signSession({ sub: shopper.id, role: "CUSTOMER", v: 0 }));
    expect((await real.getCurrentUser())?.id).toBe(shopper.id);
    // a pending-step token isn't accepted as a session
    await db.user.update({ where: { id: c.id }, data: { twoFactorRequired: false } });
    await redirected(password(c)); // signs in directly; take a pending token instead
    const m = await staff("MANAGER");
    await redirected(password(m));
    session.cookies.set(SESSION_COOKIE, session.cookies.get(PENDING_COOKIE)!);
    expect(await real.getCurrentUser()).toBeNull();
  });

  it("customers are unaffected", async () => {
    const shopper = await makeUser("CUSTOMER");
    expect(await redirected(password(shopper))).toBe("/account");
    expect(session.cookies.has(PENDING_COOKIE)).toBe(false);
    expect(sessionMock).toHaveBeenCalledWith(expect.objectContaining({ id: shopper.id }), { remember: true });
  });

  it("a new manager from an invite link sets it up before the staff area", async () => {
    const owner = await staff("ADMIN");
    const { token } = await db.$transaction((tx) => addTeamMember(tx, owner, { name: "Hari Thapa", email: "hari@test.local", job: "shop-manager", storeIds: [], all: true }));
    expect(await redirected(setPasswordFromInvite({ token, password: "NewPass2026", confirm: "NewPass2026" }))).toBe("/login/two-factor");
    expect(sessionMock).not.toHaveBeenCalled();
    expect((await verifyPending(session.cookies.get(PENDING_COOKIE)))?.stage).toBe("setup");
  });

  it("the owner resets someone's two-step sign-in (recorded, signs them out); not their own", async () => {
    const owner = await staff("ADMIN");
    const m = await staff("MANAGER");
    await setUp(m);
    const before = await db.user.findUniqueOrThrow({ where: { id: m.id } });
    actAs(owner);
    expect(await resetMemberTwoFactor({ userId: m.id, reason: "x" })).toMatchObject({ ok: false, error: expect.stringMatching(/Say why/) });
    expect(await resetMemberTwoFactor({ userId: owner.id, reason: "lost phone" })).toMatchObject({ ok: false, error: expect.stringMatching(/backup code/) });
    expect(await resetMemberTwoFactor({ userId: m.id, reason: "lost phone, checked by call" })).toEqual({ ok: true });
    const after = await db.user.findUniqueOrThrow({ where: { id: m.id }, include: { backupCodes: true } });
    expect(after).toMatchObject({ totpSecret: null, totpEnabledAt: null, tokenVersion: before.tokenVersion + 1 });
    expect(after.backupCodes).toHaveLength(0);
    expect((await db.auditLog.findFirstOrThrow({ where: { action: "team.2fa_reset" } }))).toMatchObject({ actorId: owner.id, entityId: m.id, summary: expect.stringMatching(/lost phone, checked by call/) });
    actAs(null);
    expect(await redirected(password(m))).toBe("/login/two-factor");
    expect((await verifyPending(session.cookies.get(PENDING_COOKIE)))?.stage).toBe("setup");
  });

  it("from My account: new backup codes and turning it off need a code; managers can't turn it off", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-15T06:00:00Z") });
    const c = await staff("CASHIER");
    actAs(c);
    const s = await beginTotpSetup();
    if (!s.ok) throw new Error(s.error);
    const r = await finishTotpSetup({ code: totpAt(s.secret, totpStep()) });
    expect(r).toMatchObject({ ok: true, next: "/admin/me" });
    expect(sessionMock).toHaveBeenCalledWith(expect.objectContaining({ id: c.id }), { twoFactor: true }); // this session keeps working
    expect(await beginTotpSetup()).toMatchObject({ ok: false, error: expect.stringMatching(/already on/) });

    vi.setSystemTime(new Date("2026-11-15T06:00:30Z"));
    const fresh = await newBackupCodes({ code: totpAt(s.secret, totpStep()) });
    expect(fresh).toMatchObject({ ok: true });
    vi.setSystemTime(new Date("2026-11-15T06:01:00Z"));
    expect(await turnOffTwoFactor({ code: "000000" })).toMatchObject({ ok: false });
    expect(await turnOffTwoFactor({ code: totpAt(s.secret, totpStep()) })).toEqual({ ok: true });
    expect(await db.user.findUniqueOrThrow({ where: { id: c.id } })).toMatchObject({ totpSecret: null, totpEnabledAt: null, tokenVersion: 1 });
    expect(await actions(c.id)).toEqual(["auth.2fa_enabled", "auth.2fa_backup_codes", "auth.2fa_failed", "auth.2fa_disabled"]);

    const m = await staff("MANAGER");
    const ms = await setUp(m);
    actAs(m);
    vi.setSystemTime(new Date("2026-11-15T06:01:30Z"));
    expect(await turnOffTwoFactor({ code: totpAt(ms.secret, totpStep()) })).toMatchObject({ ok: false, error: expect.stringMatching(/must use/) });
  });

  it("changing the password keeps this session's two-step status", async () => {
    const c = await staff("CASHIER");
    await db.user.update({ where: { id: c.id }, data: { totpEnabledAt: new Date() } });
    actAs(c);
    const f = new FormData(); f.set("current", "Password1"); f.set("next", "Another2026");
    expect(await changePassword(undefined, f)).toMatchObject({ ok: true });
    expect(sessionMock).toHaveBeenLastCalledWith(expect.objectContaining({ id: c.id }), { twoFactor: true });
  });
});
