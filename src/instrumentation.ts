/** Runs once when the server starts: refuse to boot production with missing or weak settings. */
export function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV !== "production") return;
  const problems: string[] = [];
  for (const key of ["DATABASE_URL", "NEXT_PUBLIC_SITE_URL", "CRON_SECRET", "MEDIA_DIR"]) if (!process.env[key]) problems.push(`${key} is not set`);
  if ((process.env.AUTH_SECRET ?? "").length < 32) problems.push("AUTH_SECRET must be at least 32 characters");
  if (problems.length && process.env.SKIP_ENV_CHECK !== "1") {
    throw new Error(`Asson cannot start:\n - ${problems.join("\n - ")}`);
  }
}
