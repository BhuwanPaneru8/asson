// Known authenticator secrets for the seeded owner and manager, in the E2E database ONLY (seed-two-factor.ts,
// run by prepare-db.ts), so tests can type their codes. Never put these anywhere else.
export const E2E_TOTP = {
  owner: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
  manager: "KRSXG5CTMVRXEZLUKRSXG5CTMVRXEZLU",
} as const;
