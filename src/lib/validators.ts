import { z } from "zod";

import { DISTRICTS, provinceOf } from "./config";

/** Nepali mobile numbers: 10 digits starting 96/97/98 (NTC, Ncell, SmartCell). */
export const phoneSchema = z.string().trim().regex(/^9[678]\d{8}$/, "Enter a valid 10-digit mobile number (98XXXXXXXX)");
export const postalCodeSchema = z.string().trim().regex(/^\d{5}$/, "Postal codes in Nepal have 5 digits");

export const addressFields = z.object({
  fullName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3, "Enter your tole / street and house no.").max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Enter your city or municipality").max(60),
  district: z.string().refine((d) => DISTRICTS.includes(d), "Select your district"),
  postalCode: postalCodeSchema.optional().or(z.literal("")),
});

/** Province is always derived from the district, so the two can never disagree. */
export const withProvince = <T extends { district: string }>(a: T) => ({ ...a, state: provinceOf(a.district)! });
export const addressSchema = addressFields.transform(withProvince);
export type AddressInput = z.output<typeof addressSchema>;

export function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[i.path.join(".")] ??= i.message;
  return out;
}
