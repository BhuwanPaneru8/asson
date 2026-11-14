import { serviceWorkerSource } from "@/lib/service-worker";

// /sw.js at the site root, so the worker's scope is the whole site. Never cached by the browser or
// Cloudflare: browsers check it for updates on every visit, and a deploy must reach them.
export const dynamic = "force-static";

export function GET() {
  return new Response(serviceWorkerSource(process.env.ASSON_RELEASE || "dev"), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Content-Security-Policy": "default-src 'self'; script-src 'self'",
    },
  });
}
