import { PROVINCES } from "./config";

// How far a location is from a delivery district, as a small number for ranking (lower = nearer):
//   0 same district · 1 same province · 2+ other provinces (provinces in east→west order, so
//   neighbours score closer than the far side of the country) · 99 location has no district set.
// Good enough to send a Kaski order from Pokhara rather than Biratnagar, without maps or APIs.

const provinceIndex = new Map(PROVINCES.flatMap((p, i) => p.districts.map((d) => [d, i] as const)));

export function distanceTier(locationDistrict: string | null | undefined, toDistrict: string | null | undefined) {
  if (!locationDistrict || !toDistrict) return 99;
  if (locationDistrict === toDistrict) return 0;
  const a = provinceIndex.get(locationDistrict), b = provinceIndex.get(toDistrict);
  if (a == null || b == null) return 99;
  return a === b ? 1 : 1 + Math.abs(a - b);
}
