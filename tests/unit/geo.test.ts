import { describe, expect, it } from "vitest";
import { distanceTier } from "@/lib/geo";

describe("distance between a location and a delivery district", () => {
  it("same district < same province < neighbouring province < far province; unknown is last", () => {
    expect(distanceTier("Kaski", "Kaski")).toBe(0);
    expect(distanceTier("Syangja", "Kaski")).toBe(1); // both Gandaki
    expect(distanceTier("Kathmandu", "Kaski")).toBe(2); // Bagmati next to Gandaki
    expect(distanceTier("Morang", "Kaski")).toBe(4); // Koshi, far east
    expect(distanceTier("Kailali", "Morang")).toBe(7); // opposite ends of the country
    expect(distanceTier(null, "Kaski")).toBe(99);
    expect(distanceTier("Kaski", undefined)).toBe(99);
  });
});
