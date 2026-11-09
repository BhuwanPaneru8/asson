import "server-only";
import { db } from "./db";
import { ktmDate } from "./pos";

// Shop funnel counters: product views → add to bag → checkout visits (orders come from the Order
// table). Daily totals only, nothing about who; written with after() so they never slow a page.

/** Search engines, link previews and monitors: not shoppers. */
export function isBot(userAgent: string | null | undefined) {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|headless|lighthouse|monitor|uptime|curl|wget|python|axios|node-fetch/i.test(userAgent);
}

export type FunnelStep = "view" | "add" | "checkout";

/** Count one step (and, for views and adds, the product). Never throws. */
export async function recordFunnel(step: FunnelStep, productId?: string) {
  const day = ktmDate();
  try {
    await db.$executeRaw`
      INSERT INTO "FunnelStat" ("day", "step", "count") VALUES (${day}, ${step}, 1)
      ON CONFLICT ("day", "step") DO UPDATE SET "count" = "FunnelStat"."count" + 1`;
    if (productId && step !== "checkout") {
      const views = step === "view" ? 1 : 0, adds = step === "add" ? 1 : 0;
      await db.$executeRaw`
        INSERT INTO "ProductStat" ("day", "productId", "views", "adds") VALUES (${day}, ${productId}, ${views}, ${adds})
        ON CONFLICT ("day", "productId") DO UPDATE SET "views" = "ProductStat"."views" + ${views}, "adds" = "ProductStat"."adds" + ${adds}`;
    }
  } catch (e) {
    console.error("recordFunnel", e);
  }
}
