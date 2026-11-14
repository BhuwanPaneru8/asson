"use client";

import { useEffect, useState } from "react";
import { useT } from "./i18n-provider";

// Installing the site as a phone app. Android (Chrome, Samsung Internet, Edge) offers install itself;
// we keep its offer so the footer's "Get the app" can show it again. iPhones have no install offer,
// so there the button explains Share → Add to Home Screen. Nothing shows once the app is installed.

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type W = Window & { __assonInstall?: InstallEvent | null };

const READY = "asson:install-ready";

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** In the root layout: registers the service worker (production builds only) and keeps the install offer. */
export function AppSetup() {
  useEffect(() => {
    const w = window as W;
    const keep = (e: Event) => { w.__assonInstall = e as InstallEvent; window.dispatchEvent(new Event(READY)); };
    const done = () => { w.__assonInstall = null; window.dispatchEvent(new Event(READY)); };
    window.addEventListener("beforeinstallprompt", keep);
    window.addEventListener("appinstalled", done);
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => { /* not supported here: the site works without it */ });
    }
    return () => { window.removeEventListener("beforeinstallprompt", keep); window.removeEventListener("appinstalled", done); };
  }, []);
  return null;
}

/** Footer button: "Get the app". Shows only where installing is possible and not done yet. */
export function InstallAppButton({ className }: { className?: string }) {
  const { t } = useT();
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const update = () => {
      if (standalone()) return setMode(null);
      if ((window as W).__assonInstall) return setMode("prompt");
      setMode(isIos() ? "ios" : null);
    };
    update();
    window.addEventListener(READY, update);
    return () => window.removeEventListener(READY, update);
  }, []);

  if (!mode) return null;

  const click = async () => {
    if (mode === "ios") return setHelp((h) => !h);
    const w = window as W, offer = w.__assonInstall;
    if (!offer) return;
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    w.__assonInstall = null; // an offer can be used once
    setMode(outcome === "accepted" ? null : isIos() ? "ios" : null);
  };

  return (
    <span className="relative inline-block">
      <button type="button" onClick={click} aria-expanded={mode === "ios" ? help : undefined} className={className}>{t("app.install")}</button>
      {help && (
        <span role="note" className="absolute bottom-full left-0 z-20 mb-2 block w-64 border border-line bg-white p-3 text-left text-[13.5px] leading-relaxed text-ink shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
          <span className="block font-semibold">{t("app.iosTitle")}</span>
          <span className="mt-1 block text-ink-soft">{t("app.iosSteps")}</span>
        </span>
      )}
    </span>
  );
}
