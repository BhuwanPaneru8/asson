import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Scheduled jobs call /api/cron/* with `Authorization: Bearer $CRON_SECRET`. */
export function isCronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  return !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
