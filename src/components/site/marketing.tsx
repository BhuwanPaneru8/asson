"use client";

/* eslint-disable prefer-rest-params, prefer-spread -- the platforms' loaders need the real `arguments` object (gtag ignores arrays) */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useShop } from "./shop-provider";
import { useT } from "./i18n-provider";
import {
  CONSENT_COOKIE, CONSENT_MAX_AGE, anyTracker, cartAdds, ga4Event, metaEvent, tiktokEvent,
  type Consent, type MarketingIds, type TrackEvent,
} from "@/lib/marketing-shared";

// Ad measurement in the browser. Until the shopper picks "Accept all" no tracker script is loaded,
// no tracker cookie is set and every event is dropped. Events: page views on every navigation,
// add to bag (by watching the bag, so every add button counts), product views, checkout, purchase.

type W = Window & {
  fbq?: ((...a: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };
  _fbq?: unknown;
  ttq?: unknown[] & Record<string, unknown>;
  TiktokAnalyticsObject?: string;
  dataLayer?: unknown[];
  gtag?: (...a: unknown[]) => void;
  __assonAds?: { ids: MarketingIds; on: boolean };
};

const OPEN_EVENT = "asson:cookie-settings";

function addScript(src: string) {
  const s = document.createElement("script");
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function loadMeta(w: W, id: string) {
  if (w.fbq) return;
  const n = function () {
    if (n.callMethod) n.callMethod.apply(n, arguments as unknown as unknown[]);
    else n.queue!.push(arguments);
  } as NonNullable<W["fbq"]>;
  w.fbq = n;
  if (!w._fbq) w._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  addScript("https://connect.facebook.net/en_US/fbevents.js");
  n("init", id);
}

function loadTikTok(w: W, id: string) {
  if (w.ttq) return;
  w.TiktokAnalyticsObject = "ttq";
  const ttq = [] as unknown as NonNullable<W["ttq"]>;
  w.ttq = ttq;
  const methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  const defer = (t: Record<string, unknown> & unknown[], m: string) => { t[m] = function () { t.push([m].concat(Array.prototype.slice.call(arguments, 0))); }; };
  for (const m of methods) defer(ttq, m);
  ttq.instance = (t: string) => {
    const e = ((ttq._i as Record<string, unknown[]>)[t] ?? []) as Record<string, unknown> & unknown[];
    for (const m of methods) defer(e, m);
    return e;
  };
  const src = "https://analytics.tiktok.com/i18n/pixel/events.js";
  ttq._i = { [id]: Object.assign([], { _u: src }) };
  ttq._t = { [id]: Date.now() };
  ttq._o = { [id]: {} };
  addScript(`${src}?sdkid=${id}&lib=ttq`);
}

function loadGa4(w: W, id: string) {
  if (w.gtag) return;
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer!.push(arguments); };
  w.gtag("js", new Date());
  w.gtag("config", id, { send_page_view: false }); // page views are sent on every navigation below
  addScript(`https://www.googletagmanager.com/gtag/js?id=${id}`);
}

const call = (fn: unknown, ...args: unknown[]) => { if (typeof fn === "function") (fn as (...a: unknown[]) => void)(...args); };

function pageView(w: W) {
  call(w.fbq, "track", "PageView");
  call((w.ttq as Record<string, unknown> | undefined)?.page);
  call(w.gtag, "event", "page_view", { page_location: location.href, page_title: document.title });
}

/** Report one shopping event to every tracker that is switched on. A no-op without consent. */
export function track(e: TrackEvent) {
  const w = window as W;
  const ads = w.__assonAds;
  if (!ads?.on) return;
  if (ads.ids.meta) {
    const [name, params] = metaEvent(e);
    call(w.fbq, "track", name, params, e.name === "purchase" ? { eventID: e.orderId } : undefined);
  }
  if (ads.ids.tiktok) {
    const [name, params] = tiktokEvent(e);
    call((w.ttq as Record<string, unknown> | undefined)?.track, name, params, e.name === "purchase" ? { event_id: e.orderId } : undefined);
  }
  if (ads.ids.ga4) {
    const [name, params] = ga4Event(e);
    call(w.gtag, "event", name, params);
  }
}

export function Marketing({ ids, initial }: { ids: MarketingIds; initial: Consent | null }) {
  const { t } = useT();
  const pathname = usePathname();
  const { cart } = useShop();
  const [consent, setConsent] = useState<Consent | null>(initial);
  const [open, setOpen] = useState(initial === null);
  const on = consent === "all" && anyTracker(ids);
  const prevLines = useRef(cart.lines);

  // load the trackers once the shopper agrees (stubs queue calls until each script arrives)
  useEffect(() => {
    const w = window as W;
    w.__assonAds = { ids, on };
    if (!on) return;
    if (ids.meta) loadMeta(w, ids.meta);
    if (ids.tiktok) loadTikTok(w, ids.tiktok);
    if (ids.ga4) loadGa4(w, ids.ga4);
  }, [on, ids]);

  useEffect(() => {
    if (on) pageView(window as W);
  }, [on, pathname]);

  // anything added to the bag since the last render, from any add button on the site
  useEffect(() => {
    const adds = cartAdds(prevLines.current, cart.lines);
    prevLines.current = cart.lines;
    if (on && adds.length) track({ name: "add_to_cart", items: adds });
  }, [on, cart.lines]);

  // "Cookie settings" in the footer opens the banner again
  useEffect(() => {
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => window.removeEventListener(OPEN_EVENT, reopen);
  }, []);

  const choose = (c: Consent) => {
    document.cookie = `${CONSENT_COOKIE}=${c}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setOpen(false);
    // changing your mind from "all" to "necessary": stop now, and start clean on the next page load
    if (consent === "all" && c === "essential") { location.reload(); return; }
    setConsent(c);
  };

  if (!anyTracker(ids) || !open) return null;
  const who = [ids.meta && "Meta", ids.tiktok && "TikTok", ids.ga4 && "Google"].filter(Boolean).join(", ");
  return (
    <div role="region" aria-label={t("consent.label")} className="fixed inset-x-0 bottom-0 z-50 p-3 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-md sm:p-0">
      <div className="border border-line bg-white p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <p className="text-[15px] font-semibold text-ink">{t("consent.title")}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
          {t("consent.body", { who })}{" "}
          <Link href="/policies/cookies" className="underline underline-offset-2 hover:text-accent">{t("consent.more")}</Link>
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => choose("all")} className="h-11 flex-1 bg-ink px-4 text-[14px] font-medium text-white hover:bg-ink/90">{t("consent.accept")}</button>
          <button type="button" onClick={() => choose("essential")} className="h-11 flex-1 border border-ink px-4 text-[14px] font-medium text-ink hover:bg-cloud">{t("consent.essential")}</button>
        </div>
      </div>
    </div>
  );
}

/** Footer link that reopens the cookie banner. */
export function CookieSettingsButton({ label }: { label: string }) {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))} className="hover:text-ink">{label}</button>;
}

/** Report one event when a page shows (product view, checkout). `once` keys stop repeats on refresh. */
export function TrackOnView({ event, once }: { event: TrackEvent; once?: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    // wait a tick so the Marketing effects (which load the trackers) have run first
    const id = setTimeout(() => {
      if (!(window as W).__assonAds?.on) return;
      if (once) {
        try { if (localStorage.getItem(once)) return; localStorage.setItem(once, "1"); } catch { /* private mode: send anyway */ }
      }
      sent.current = true;
      track(event);
    }, 0);
    return () => clearTimeout(id);
  }, [event, once]);
  return null;
}
