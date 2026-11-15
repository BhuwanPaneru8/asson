import { describe, expect, it } from "vitest";
import {
  base32Decode, base32Encode, BACKUP_CODE_COUNT, decryptSecret, encryptSecret, hashBackupCode, looksLikeBackupCode, matchTotp,
  newBackupCodes, newTotpSecret, normaliseBackupCode, otpauthUri, totpAt, totpNow, totpStep,
} from "@/lib/two-factor-core";
import { twoFactorStep } from "@/lib/permissions";

// RFC 6238 appendix B: the SHA-1 secret is ASCII "12345678901234567890"; the 8-digit codes' last 6 digits
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));
const RFC = [[59, "287082"], [1111111109, "081804"], [1111111111, "050471"], [1234567890, "005924"], [2000000000, "279037"], [20000000000, "353130"]] as const;

describe("authenticator codes (TOTP)", () => {
  it("matches the RFC 6238 test vectors", () => {
    expect(RFC_SECRET).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    for (const [t, code] of RFC) expect(totpNow(RFC_SECRET, t * 1000)).toBe(code);
  });

  it("base32 round-trips any bytes, ignoring case, spaces and padding", () => {
    for (let i = 0; i < 50; i++) {
      const s = newTotpSecret();
      expect(s).toMatch(/^[A-Z2-7]{32}$/); // 160 bits
      expect(base32Encode(base32Decode(s))).toBe(s);
      expect(base32Decode(s.toLowerCase().match(/.{1,4}/g)!.join(" ") + "====").equals(base32Decode(s))).toBe(true);
    }
    expect(() => base32Decode("NOT-BASE32-1!")).toThrow();
  });

  it("accepts the step either side (clock drift), nothing further", () => {
    const at = 1_800_000_000_000, s = totpStep(at), secret = newTotpSecret();
    expect(matchTotp(secret, totpAt(secret, s), at)).toBe(s);
    expect(matchTotp(secret, totpAt(secret, s - 1), at)).toBe(s - 1);
    expect(matchTotp(secret, totpAt(secret, s + 1), at)).toBe(s + 1);
    expect(matchTotp(secret, totpAt(secret, s - 2), at)).toBeNull();
    expect(matchTotp(secret, totpAt(secret, s + 2), at)).toBeNull();
  });

  it("a code works once: steps up to the last one used are refused", () => {
    const at = 1_800_000_000_000, s = totpStep(at), secret = newTotpSecret();
    expect(matchTotp(secret, totpAt(secret, s), at, s)).toBeNull();
    expect(matchTotp(secret, totpAt(secret, s - 1), at, s - 1)).toBeNull();
    expect(matchTotp(secret, totpAt(secret, s + 1), at, s)).toBe(s + 1);
  });

  it("refuses wrong, short or junk codes, and tolerates spaces", () => {
    const at = 1_800_000_000_000, secret = newTotpSecret(), code = totpNow(secret, at);
    expect(matchTotp(secret, `${code.slice(0, 3)} ${code.slice(3)}`, at)).toBe(totpStep(at));
    expect(matchTotp(secret, code.slice(0, 5), at)).toBeNull();
    expect(matchTotp(secret, "abcdef", at)).toBeNull();
    expect(matchTotp(secret, String((Number(code) + 1) % 1e6).padStart(6, "0"), at)).toBeNull();
  });

  it("builds the otpauth URI apps scan", () => {
    expect(otpauthUri("JBSWY3DPEHPK3PXP", "sita@asson.com.np", "Asson")).toBe("otpauth://totp/Asson%3Asita%40asson.com.np?secret=JBSWY3DPEHPK3PXP&issuer=Asson&algorithm=SHA1&digits=6&period=30");
  });
});

describe("backup codes", () => {
  it("makes 10 different readable codes", () => {
    const codes = newBackupCodes();
    expect(codes).toHaveLength(BACKUP_CODE_COUNT);
    expect(new Set(codes).size).toBe(BACKUP_CODE_COUNT);
    for (const c of codes) {
      expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/);
      expect(c).not.toMatch(/[01ilo]/); // nothing that reads as another character
      expect(looksLikeBackupCode(c)).toBe(true);
    }
  });

  it("ignores case, spaces and dashes when checking", () => {
    expect(normaliseBackupCode(" K7M2P - X9QAT ")).toBe("k7m2px9qat");
    expect(hashBackupCode("u1", "K7M2P X9QAT", "pepper")).toBe(hashBackupCode("u1", "k7m2p-x9qat", "pepper"));
  });

  it("hashes per person and per key: the same code for someone else, or another key, doesn't match", () => {
    const h = hashBackupCode("u1", "k7m2p-x9qat", "pepper");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain("k7m2p");
    expect(hashBackupCode("u2", "k7m2p-x9qat", "pepper")).not.toBe(h);
    expect(hashBackupCode("u1", "k7m2p-x9qat", "other")).not.toBe(h);
  });
});

describe("secret encryption at rest", () => {
  const env = { TWO_FACTOR_KEY: "k".repeat(40), AUTH_SECRET: "a".repeat(40) };

  it("round-trips, with a fresh IV each time and no plaintext in the stored value", () => {
    const s = newTotpSecret();
    const a = encryptSecret(s, env), b = encryptSecret(s, env);
    expect(a).not.toBe(b);
    expect(a).not.toContain(s);
    expect(a.startsWith("v1:k:")).toBe(true);
    expect(decryptSecret(a, env)).toBe(s);
  });

  it("refuses a tampered value or the wrong key", () => {
    const stored = encryptSecret("JBSWY3DPEHPK3PXP", env);
    const parts = stored.split(":");
    const flipped = Buffer.from(parts[4], "base64url"); flipped[0] ^= 1;
    expect(() => decryptSecret([...parts.slice(0, 4), flipped.toString("base64url")].join(":"), env)).toThrow();
    expect(() => decryptSecret(stored, { TWO_FACTOR_KEY: "x".repeat(40), AUTH_SECRET: env.AUTH_SECRET })).toThrow();
  });

  it("falls back to a key from AUTH_SECRET, and still reads those after TWO_FACTOR_KEY is added", () => {
    const old = encryptSecret("JBSWY3DPEHPK3PXP", { AUTH_SECRET: env.AUTH_SECRET });
    expect(old.startsWith("v1:a:")).toBe(true);
    expect(decryptSecret(old, env)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => decryptSecret(encryptSecret("X", env), { AUTH_SECRET: env.AUTH_SECRET })).toThrow(/TWO_FACTOR_KEY is missing/);
    expect(() => encryptSecret("X", {})).toThrow(/must be set/);
  });

  it("ignores a TWO_FACTOR_KEY that is too short", () => {
    expect(encryptSecret("X", { TWO_FACTOR_KEY: "short", AUTH_SECRET: env.AUTH_SECRET }).startsWith("v1:a:")).toBe(true);
  });
});

describe("who needs two-step sign-in", () => {
  const off = { twoFactorRequired: false, totpEnabledAt: null };
  it("managers and owners must set it up; others only when the owner requires it; customers never", () => {
    expect(twoFactorStep({ role: "ADMIN", ...off })).toBe("setup");
    expect(twoFactorStep({ role: "MANAGER", ...off })).toBe("setup");
    expect(twoFactorStep({ role: "CASHIER", ...off })).toBe("none");
    expect(twoFactorStep({ role: "STAFF", ...off })).toBe("none");
    expect(twoFactorStep({ role: "CASHIER", twoFactorRequired: true, totpEnabledAt: null })).toBe("setup");
    expect(twoFactorStep({ role: "CUSTOMER", twoFactorRequired: true, totpEnabledAt: new Date() })).toBe("none");
  });
  it("anyone who turned it on is asked for a code", () => {
    expect(twoFactorStep({ role: "CASHIER", twoFactorRequired: false, totpEnabledAt: new Date() })).toBe("verify");
    expect(twoFactorStep({ role: "MANAGER", twoFactorRequired: false, totpEnabledAt: new Date() })).toBe("verify");
  });
});
