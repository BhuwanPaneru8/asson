import { describe, expect, it, vi } from "vitest";
import { adminManifest, shopManifest } from "@/lib/app-manifest";
import { ICON_FILES } from "@/lib/app-icon";
import { serviceWorkerSource } from "@/lib/service-worker";

describe("installable app: manifests", () => {
  it("makes two separate apps, the shop and the staff app, each with icons that exist", () => {
    const shop = shopManifest(), admin = adminManifest();
    expect(shop).toMatchObject({ id: "/", start_url: "/", scope: "/", display: "standalone", name: "Asson" });
    expect(admin).toMatchObject({ id: "/admin", start_url: "/admin", scope: "/admin", display: "standalone", name: "Asson Admin" });
    for (const m of [shop, admin]) {
      const icons = m.icons ?? [];
      expect(icons.map((i) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
      expect(icons.some((i) => i.purpose === "maskable")).toBe(true);
      for (const i of icons) expect(Object.keys(ICON_FILES)).toContain(i.src.replace("/icons/", ""));
    }
    expect(shop.icons![0].src).toContain("shop-");
    expect(admin.icons![0].src).toContain("admin-");
    for (const s of admin.shortcuts ?? []) expect(s.url.startsWith("/admin")).toBe(true); // stays inside its scope
  });
});

/** Runs the worker's code against fake browser APIs and returns its event handlers. */
function loadWorker(release: string, network: (url: string) => Promise<Response>) {
  const stores = new Map<string, Map<string, Response>>();
  const handlers: Record<string, (e: unknown) => void> = {};
  const key = (r: string | Request) => new URL(typeof r === "string" ? r : r.url, "https://asson.test").pathname;
  const caches = {
    open: async (name: string) => {
      if (!stores.has(name)) stores.set(name, new Map());
      const m = stores.get(name)!;
      return {
        put: async (r: string | Request, res: Response) => void m.set(key(r), res),
        add: async (r: string) => { const res = await network(r); if (!res.ok) throw new Error("bad"); m.set(key(r), res); },
      };
    },
    keys: async () => [...stores.keys()],
    delete: async (name: string) => stores.delete(name),
    match: async (r: string | Request, o?: { cacheName?: string }) => stores.get(o?.cacheName ?? "")?.get(key(r))?.clone(),
  };
  const self = {
    location: { origin: "https://asson.test" },
    addEventListener: (type: string, fn: (e: unknown) => void) => { handlers[type] = fn; },
    skipWaiting: vi.fn(async () => {}),
    clients: { claim: vi.fn(async () => {}) },
  };
  const fetchFn = (r: string | Request) => network(typeof r === "string" ? r : r.url);
  new Function("self", "caches", "fetch", "Response", serviceWorkerSource(release))(self, caches, fetchFn, Response);

  const run = async (type: string, extra: object = {}) => {
    let waited: Promise<unknown> | undefined, responded: Promise<Response> | undefined;
    handlers[type]({ ...extra, waitUntil: (p: Promise<unknown>) => { waited = p; }, respondWith: (p: Promise<Response>) => { responded = p; } });
    await waited;
    return responded ? await responded : undefined;
  };
  return { stores, run };
}

const html = '<html><link rel="stylesheet" href="/_next/static/css/app-1a2b.css"><script src="/_next/static/chunks/main-9f.js"></script></html>';

describe("installable app: service worker", () => {
  const net = vi.fn(async (url: string) => {
    if (url.includes("offline")) return new Response(html, { headers: { "Content-Type": "text/html" } });
    if (url.includes("/_next/static/")) return new Response("asset:" + url);
    return new Response("page:" + url);
  });

  it("saves the offline page and the files it needs when it installs, under this release's name", async () => {
    const w = loadWorker("39582e8", net);
    await w.run("install");
    const store = w.stores.get("asson-39582e8")!;
    expect([...store.keys()].sort()).toEqual(["/_next/static/chunks/main-9f.js", "/_next/static/css/app-1a2b.css", "/offline"]);
  });

  it("serves pages fresh from the server and shows the offline page only when the network fails", async () => {
    const w = loadWorker("r1", net);
    await w.run("install");
    // a normal visit: straight from the server, never stored
    const navigate = (url: string) => ({ request: Object.defineProperty(new Request(`https://asson.test${url}`), "mode", { value: "navigate" }) });
    expect(await (await w.run("fetch", navigate("/p/oxford")))!.text()).toBe("page:https://asson.test/p/oxford");
    expect(w.stores.get("asson-r1")!.has("/p/oxford")).toBe(false);
    // no connection: the saved offline page
    net.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await (await w.run("fetch", navigate("/checkout")))!.text()).toBe(html);
  });

  it("leaves everything else alone: other sites, form posts, API calls", async () => {
    const w = loadWorker("r1", net);
    await w.run("install");
    const req = (url: string, init?: RequestInit) => ({ request: new Request(url, init) });
    expect(await w.run("fetch", req("https://connect.facebook.net/en_US/fbevents.js"))).toBeUndefined();
    expect(await w.run("fetch", req("https://asson.test/api/health"))).toBeUndefined();
    expect(await w.run("fetch", req("https://asson.test/checkout", { method: "POST", body: "x" }))).toBeUndefined();
  });

  it("drops the previous release's store when a new one takes over", async () => {
    const old = loadWorker("old", net);
    await old.run("install");
    const next = loadWorker("new", net);
    for (const [k, v] of old.stores) next.stores.set(k, v);
    next.stores.set("someone-else", new Map());
    await next.run("install");
    await next.run("activate");
    expect([...next.stores.keys()].sort()).toEqual(["asson-new", "someone-else"]);
  });

  it("keeps the till's offline copy only when the till asks, and shows it when the till can't load", async () => {
    const w = loadWorker("r2", net);
    await w.run("install");
    expect(w.stores.get("asson-r2")!.has("/pos-offline")).toBe(false); // shoppers' phones never download it
    const navigate = (url: string) => ({ request: Object.defineProperty(new Request(`https://asson.test${url}`), "mode", { value: "navigate" }) });
    net.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await (await w.run("fetch", navigate("/admin/pos")))!.text()).toBe(html); // not saved yet: the plain offline page
    net.mockImplementationOnce(async () => new Response('<html><script src="/_next/static/chunks/till-77.js"></script></html>'));
    await w.run("message", { data: { type: "save-till-shell" } });
    const store = w.stores.get("asson-r2")!;
    expect(store.has("/pos-offline")).toBe(true);
    expect(store.has("/_next/static/chunks/till-77.js")).toBe(true);
    // fetched without cookies, so the saved copy can't hold anyone's data
    expect(net).toHaveBeenCalledWith("/pos-offline");
    net.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await (await w.run("fetch", navigate("/admin/pos")))!.text()).toContain("till-77.js");
    net.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await (await w.run("fetch", navigate("/admin/orders")))!.text()).toBe(html); // the rest of the admin: the offline page
    net.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await (await w.run("fetch", navigate("/admin/pos/receipt/abc")))!.text()).toBe(html);
    // online, the till always comes fresh from the server, never from the saved copy
    expect(await (await w.run("fetch", navigate("/admin/pos")))!.text()).toBe("page:https://asson.test/admin/pos");
    await w.run("message", { data: { type: "something-else" } });
  });

  it("puts only safe characters of the release into the store name", () => {
    expect(serviceWorkerSource('a"b;c')).toContain('const CACHE = "asson-abc";');
    expect(serviceWorkerSource("")).toContain('"asson-dev"');
  });
});
