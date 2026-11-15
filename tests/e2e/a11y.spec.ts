import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

// Accessibility basics on every page people use: the page's language, one main heading, a main landmark, images
// with alt text, buttons and links with a name, form fields with a label, no duplicate ids. Not a full audit
// (colour contrast is checked on the palette in globals.css), but it catches the usual regressions.

async function audit(page: Page) {
  return page.evaluate(() => {
    const vis = (el: Element) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== "none" && s.visibility !== "hidden" && (r.width > 0 || r.height > 0); };
    const name = (el: Element) => (el.getAttribute("aria-label") || (el.getAttribute("aria-labelledby") ?? "").split(" ").map((i) => document.getElementById(i)?.textContent ?? "").join(" ") || el.textContent || el.getAttribute("title") || [...el.querySelectorAll("img[alt]")].map((i) => (i as HTMLImageElement).alt).join(" ") || "").trim();
    const issues: string[] = [];
    if (!document.documentElement.lang) issues.push("no lang on <html>");
    if (document.querySelectorAll("h1").length !== 1) issues.push(`${document.querySelectorAll("h1").length} <h1> elements (want 1)`);
    const mains = document.querySelectorAll("main").length;
    if (mains !== 1) issues.push(`${mains} <main> landmarks (want 1)`);
    for (const img of document.querySelectorAll("img")) if (!img.hasAttribute("alt")) issues.push(`image without alt: ${img.src.slice(-50)}`);
    for (const el of document.querySelectorAll("button, a[href], [role=button]")) if (vis(el) && !name(el)) issues.push(`control without a name: ${el.outerHTML.slice(0, 120)}`);
    for (const el of document.querySelectorAll("input:not([type=hidden]), select, textarea")) {
      if (!vis(el)) continue;
      const ok = el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) || el.closest("label") || el.getAttribute("title");
      if (!ok) issues.push(`field without a label: ${el.outerHTML.slice(0, 120)}`);
    }
    const ids = [...document.querySelectorAll("[id]")].map((e) => e.id);
    const dup = [...new Set(ids.filter((x, i) => ids.indexOf(x) !== i))];
    if (dup.length) issues.push(`duplicate ids: ${dup.join(", ")}`);
    return [...new Set(issues)];
  });
}

const SHOP = ["/", "/c/women", "/p/oxford-button-down-shirt", "/shop?q=shirt", "/p/no-such-product", "/cart", "/checkout", "/login", "/register", "/help", "/size-guide", "/lookbook", "/stores", "/about", "/shop?q=zzqqxx", "/policies", "/policies/terms", "/policies/privacy", "/policies/returns"];
const STAFF = ["/admin", "/admin/activity", "/admin/bins", "/admin/care", "/admin/cash", "/admin/closing", "/admin/cod", "/admin/counts", "/admin/coupons", "/admin/customers", "/admin/damaged", "/admin/delivery",
  "/admin/finance", "/admin/finance/bank", "/admin/finance/budgets", "/admin/finance/close", "/admin/finance/shops", "/admin/finance/vat", "/admin/finance/year", "/admin/fulfilment", "/admin/fulfilment/deliveries", "/admin/fulfilment/exchanges",
  "/admin/insights", "/admin/insights?tab=demand", "/admin/inventory", "/admin/issues", "/admin/locations", "/admin/markdowns", "/admin/network", "/admin/notifications", "/admin/ops", "/admin/orders", "/admin/payables", "/admin/payroll", "/admin/people", "/admin/people/absences",
  "/admin/picking", "/admin/production", "/admin/products", "/admin/products/new", "/admin/purchasing", "/admin/replenishment", "/admin/reviews", "/admin/rosters", "/admin/scorecard", "/admin/suppliers", "/admin/team", "/admin/today", "/admin/handbook", "/admin/handbook/onboarding", "/admin/handbook/sys-pos", "/admin/handbook/worldclass-review", "/admin/training", "/admin/training/new", "/admin/transfers", "/admin/visits", "/admin/vm"];

test("shop pages meet the accessibility basics", async ({ page }) => {
  const found: Record<string, string[]> = {};
  for (const path of SHOP) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const issues = await audit(page);
    if (issues.length) found[path] = issues;
  }
  expect(found).toEqual({});
});

test("staff pages meet the accessibility basics", async ({ page }) => {
  test.setTimeout(240_000);
  await signIn(page, "owner", "/admin");
  const found: Record<string, string[]> = {};
  for (const path of STAFF) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const issues = await audit(page);
    if (issues.length) found[path] = issues;
  }
  expect(found).toEqual({});
});
