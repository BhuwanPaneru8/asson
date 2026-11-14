import type { MetadataRoute } from "next";
import { store } from "./config";

// Two installable apps from one site: the shop (whole site) and the staff app (/admin only), each with
// its own name and icon so a shop worker who also shops here can tell them apart on their phone.
// Served from /manifest.webmanifest and /admin.webmanifest, outside /admin on purpose: browsers fetch
// manifests without cookies, so one under /admin would be redirected to the sign-in page.

export const SHOP_MANIFEST = "/manifest.webmanifest";
export const ADMIN_MANIFEST = "/admin.webmanifest";

const icons = (prefix: "shop" | "admin"): MetadataRoute.Manifest["icons"] => [
  { src: `/icons/${prefix}-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
  { src: `/icons/${prefix}-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
  { src: `/icons/${prefix}-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
];

export function shopManifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: store.name,
    short_name: store.name,
    description: store.tagline,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbfaf8",
    theme_color: "#fbfaf8",
    lang: "en",
    categories: ["shopping", "lifestyle"],
    icons: icons("shop"),
    // long-press the icon on Android
    shortcuts: [
      { name: "Shop new in", short_name: "Shop", url: "/shop" },
      { name: "Your bag", short_name: "Bag", url: "/cart" },
      { name: "Your orders", short_name: "Orders", url: "/account/orders" },
      { name: "Track an order", short_name: "Track", url: "/track" },
    ],
  };
}

export function adminManifest(): MetadataRoute.Manifest {
  return {
    id: "/admin",
    name: `${store.name} Admin`,
    short_name: `${store.name} Admin`,
    description: `Run ${store.name}: orders, stock, the till and your team.`,
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#ffffff",
    lang: "en",
    categories: ["business", "productivity"],
    icons: icons("admin"),
    shortcuts: [
      { name: "Orders", url: "/admin/orders" },
      { name: "Today", url: "/admin/today" },
    ],
  };
}

/** A manifest as a response: short browser cache, so a change reaches installed apps within a day. */
export function manifestResponse(m: MetadataRoute.Manifest) {
  return new Response(JSON.stringify(m), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
