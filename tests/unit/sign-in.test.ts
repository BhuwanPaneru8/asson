import { describe, expect, it } from "vitest";
import { parseIdentifier, passwordScore } from "@/lib/sign-in-shared";

describe("one-step sign-in", () => {
  it("reads a Nepali mobile number however it's typed, or an email", () => {
    for (const s of ["9841234567", "984 123 4567", "+977-9841234567", "977 9841234567", " (984) 1234567 "]) expect(parseIdentifier(s)).toEqual({ kind: "phone", value: "9841234567" });
    expect(parseIdentifier("Sita.Rai@Mail.COM ")).toEqual({ kind: "email", value: "sita.rai@mail.com" });
    expect(parseIdentifier("1234567890")).toBeNull(); // not a mobile
    expect(parseIdentifier("sita@")).toBeNull();
    expect(parseIdentifier("")).toBeNull();
  });

  it("scores passwords for the meter", () => {
    expect(passwordScore("")).toBe(0);
    expect(passwordScore("abcdefg1")).toBe(1);
    expect(passwordScore("Abcdefgh1234")).toBe(3);
    expect(passwordScore("Abcdefgh123!")).toBe(4);
  });
});
