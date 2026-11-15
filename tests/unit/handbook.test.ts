import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAGES, PATHS, SECTIONS, pageBySlug } from "@/handbook";
import { JOBS, effectivePermissions, type StaffRole } from "@/lib/permissions";
import { parseHandbook } from "@/components/admin/handbook-text";

// The handbook lives in code, so these checks catch a broken link, a missing page on someone's path, or a
// question whose answer points nowhere, in CI, before staff ever see it.

const ADMIN = path.join(process.cwd(), "src/app/admin/(staff)"); // staff pages live in the (staff) route group

/** Does an /admin/... link point at a real page (dynamic segments match anything)? */
function adminRouteExists(href: string) {
  const parts = href.replace(/[?#].*$/, "").replace(/^\/admin\/?/, "").split("/").filter(Boolean);
  let dir = ADMIN;
  for (const p of parts) {
    if (existsSync(path.join(dir, p))) { dir = path.join(dir, p); continue; }
    const dyn = readdirSync(dir).find((d) => d.startsWith("["));
    if (!dyn) return false;
    dir = path.join(dir, dyn);
  }
  return existsSync(path.join(dir, "page.tsx"));
}

describe("handbook content", () => {
  it("has unique slugs, real sections, and every page filled in", () => {
    const slugs = PAGES.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const p of PAGES) {
      expect(SECTIONS.some((s) => s.key === p.section), p.slug).toBe(true);
      expect(p.slug).toMatch(/^[a-z0-9-]+$/);
      expect(p.body.length, p.slug).toBeGreaterThan(300);
      expect(p.summary.length, p.slug).toBeGreaterThan(20);
      expect(p.version).toBeGreaterThanOrEqual(1);
    }
    for (const s of SECTIONS) expect(PAGES.some((p) => p.section === s.key), s.key).toBe(true);
  });

  it("links only to pages that exist, inside and outside the handbook", () => {
    for (const p of PAGES) {
      for (const r of p.related ?? []) expect(pageBySlug(r), `${p.slug} → related ${r}`).toBeDefined();
      for (const o of p.open ?? []) expect(adminRouteExists(o.href), `${p.slug} → ${o.href}`).toBe(true);
      for (const m of p.body.matchAll(/\]\((\/admin[^)\s]*)\)/g)) expect(adminRouteExists(m[1]), `${p.slug} → ${m[1]}`).toBe(true);
    }
  });

  it("gives every job a reading path of real pages that the job can open", () => {
    expect(PATHS.map((p) => p.job).sort()).toEqual(JOBS.map((j) => j.key).sort());
    for (const path of PATHS) {
      const job = JOBS.find((j) => j.key === path.job)!;
      const perms = effectivePermissions(job.role as StaffRole, job.key);
      expect(new Set(path.read).size, `${path.job} has duplicates`).toBe(path.read.length);
      expect(path.read.length).toBeGreaterThan(15);
      expect(path.read[0]).toBe("welcome");
      for (const slug of path.read) {
        const page = pageBySlug(slug);
        expect(page, `${path.job} path → ${slug}`).toBeDefined();
        if (page?.restricted) expect(perms, `${path.job} can't open ${slug}`).toContain(page.restricted);
      }
      // the job's own page is on its path
      expect(path.read).toContain(`job-${path.job}`);
    }
  });

  it("asks questions with a valid right answer and an explanation", () => {
    const quizzes = PAGES.filter((p) => p.quiz?.length);
    expect(quizzes.length).toBeGreaterThan(15);
    for (const p of quizzes) for (const q of p.quiz!) {
      expect(q.options.length, p.slug).toBeGreaterThanOrEqual(2);
      expect(q.answer, `${p.slug}: ${q.q}`).toBeLessThan(q.options.length);
      expect(q.why.length).toBeGreaterThan(10);
    }
  });

  it("renders the text format: headings, steps that keep their numbers, tables, callouts, checklists", () => {
    const b = parseHandbook("## Title\nIntro line\ncontinues here\n\n1. One\n2. Two\n- sub point\n3. Three\n| a | b |\n|---|---|\n| 1 | 2 |\n> **Rule:** never\n- [ ] tick me");
    expect(b.map((x) => x.kind)).toEqual(["h2", "p", "ol", "ul", "ol", "table", "callout", "check"]);
    expect(b[1]).toEqual({ kind: "p", text: "Intro line continues here" });
    expect(b[4]).toMatchObject({ kind: "ol", start: 3, items: ["Three"] });
    expect(b[5]).toMatchObject({ head: ["a", "b"], rows: [["1", "2"]] });
  });
});
