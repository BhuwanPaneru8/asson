// The service worker that makes the site installable and shows a friendly page when the phone is
// offline. It deliberately caches almost nothing: prices, stock, bags and accounts always come fresh
// from the server, so nobody ever sees an old price or another person's page. What it keeps:
//   - the /offline page and the CSS/JS it needs, saved when the worker installs;
//   - nothing else. Build files (/_next/static, named by content hash) are served from that store when
//     present, otherwise straight from the network.
// Each release gets its own store name, so a deploy replaces the old offline page.

export const OFFLINE_PATH = "/offline";

export function serviceWorkerSource(release: string) {
  const cache = `asson-${release.replace(/[^\w.-]/g, "") || "dev"}`;
  return `// Asson service worker (release ${cache})
const CACHE = ${JSON.stringify(cache)};
const OFFLINE = ${JSON.stringify(OFFLINE_PATH)};

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const store = await caches.open(CACHE);
    const res = await fetch(OFFLINE, { cache: "reload", credentials: "omit" });
    if (!res.ok) throw new Error("offline page " + res.status);
    const html = await res.clone().text();
    await store.put(OFFLINE, res);
    const assets = [...new Set(html.match(/\\/_next\\/static\\/[^"'\\s)\\\\]+/g) || [])];
    await Promise.all(assets.map((a) => store.add(a).catch(() => undefined)));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) if (name.startsWith("asson-") && name !== CACHE) await caches.delete(name);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(async () => (await caches.match(OFFLINE, { cacheName: CACHE })) || Response.error()));
    return;
  }
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.match(req, { cacheName: CACHE }).then((hit) => hit || fetch(req)));
  }
});
`;
}
