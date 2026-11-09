import { describe, expect, it } from "vitest";
import { addressLines, discountPercent, formatOrderNumber, formatPrice, parseOrderNumber, slugify } from "@/lib/utils";
import { addressSchema, phoneSchema } from "@/lib/validators";
import { DISTRICTS, PROVINCES, provinceOf, zoneOf } from "@/lib/config";

describe("formatting", () => {
  it("formats paisa as Nepali rupees with lakh grouping", () => {
    expect(formatPrice(149_900)).toBe("Rs. 1,499");
    expect(formatPrice(14_990_000)).toBe("Rs. 1,49,900");
    expect(formatPrice(-5_000)).toBe("-Rs. 50");
  });
  it("round-trips order numbers", () => {
    expect(formatOrderNumber(123)).toBe("AS000123");
    expect(parseOrderNumber("AS000123")).toBe(123);
    expect(parseOrderNumber(" as000123 ")).toBe(123);
    expect(parseOrderNumber("#123")).toBe(123);
    expect(parseOrderNumber("abc")).toBeNull();
  });
  it("computes discount badges and slugs", () => {
    expect(discountPercent(239_900, 319_900)).toBe(25);
    expect(discountPercent(1000, null)).toBe(0);
    expect(slugify("Linen Shirt — Organic!")).toBe("linen-shirt-organic");
  });
  it("prints Nepal addresses and skips store sales", () => {
    expect(addressLines({ line1: "Baneshwor-10", line2: "Near bank", city: "Kathmandu", district: "Kathmandu", state: "Bagmati", postalCode: "44600" }))
      .toEqual(["Baneshwor-10, Near bank", "Kathmandu", "Bagmati Province 44600"]);
    expect(addressLines({})).toEqual([]);
  });
});

describe("Nepal geography", () => {
  it("has 7 provinces and 77 unique districts", () => {
    expect(PROVINCES).toHaveLength(7);
    expect(DISTRICTS).toHaveLength(77);
    expect(new Set(DISTRICTS).size).toBe(77);
  });
  it("maps districts to provinces and zones", () => {
    expect(provinceOf("Kanchanpur")).toBe("Sudurpashchim");
    expect(zoneOf("Lalitpur")).toBe("VALLEY");
    expect(zoneOf("Mustang")).toBe("REMOTE");
    expect(zoneOf(undefined)).toBe("OUTSIDE");
  });
});

describe("validators", () => {
  it("accepts Nepali mobiles only", () => {
    for (const ok of ["9841234567", "9801234567", "9612345678", "9712345678"]) expect(phoneSchema.safeParse(ok).success).toBe(true);
    for (const bad of ["9512345678", "984123456", "+9779841234567", "1234567890"]) expect(phoneSchema.safeParse(bad).success).toBe(false);
  });
  it("derives the province from the district so they can never disagree", () => {
    const r = addressSchema.parse({ fullName: "Ram", phone: "9841234567", line1: "Lakeside-6", city: "Pokhara", district: "Kaski", postalCode: "" });
    expect(r.state).toBe("Gandaki");
  });
  it("rejects unknown districts and bad postal codes", () => {
    expect(addressSchema.safeParse({ fullName: "Ram", phone: "9841234567", line1: "Somewhere", city: "X", district: "Atlantis" }).success).toBe(false);
    expect(addressSchema.safeParse({ fullName: "Ram", phone: "9841234567", line1: "Somewhere", city: "X", district: "Kaski", postalCode: "123" }).success).toBe(false);
  });
});
