// Sign-in helpers safe in the browser too (the server re-checks everything).

export type Identifier = { kind: "phone"; value: string } | { kind: "email"; value: string };

/** "98 4123 4567", "+977-9841234567" → phone 9841234567; "Sita@Mail.com" → email sita@mail.com. */
export function parseIdentifier(raw: string): Identifier | null {
  const s = raw.trim();
  const digits = s.replace(/[\s\-()]/g, "").replace(/^\+?977/, "");
  if (/^9[678]\d{8}$/.test(digits)) return { kind: "phone", value: digits };
  const email = s.toLowerCase();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) && email.length <= 254) return { kind: "email", value: email };
  return null;
}

/** How strong a password is, 0–4, for the meter under the field (the rules themselves are enforced on the server). */
export function passwordScore(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}
