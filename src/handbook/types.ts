import type { JobKey, Permission } from "@/lib/permissions";

// The Asson Handbook: everything about how the company and this system work, kept in the codebase so it
// changes in the same pull request as the feature it describes. Shown at Admin → Handbook.
//
// Writing a page: `body` is simple text. "## " and "### " headings, "- " points, "1. " steps, "- [ ] " checklist
// items, "> " callouts (start with **Rule:**, **Tip:** or **Why:** to colour them), tables with "|" rows,
// **bold**, and [links](/admin/...). No backticks (the bodies are template strings).
// Raise `version` when a change means people must read the page again (it shows as "changed" on their path).

export type SectionKey = "start" | "system" | "shop" | "procedures" | "roles" | "hiring" | "owner" | "worldclass";

export type Question = {
  q: string;
  options: string[];
  /** index into options */
  answer: number;
  /** shown after answering: why that's the answer */
  why: string;
};

export type HandbookPage = {
  slug: string;
  section: SectionKey;
  title: string;
  /** one sentence: what this page gives the reader */
  summary: string;
  /** jobs this page is written for ("all": everyone on the team) */
  audience: JobKey[] | "all";
  /** reading time in minutes */
  minutes: number;
  /** pages that need this permission to open (strategy, money); everything else is open to every staff member */
  restricted?: Permission;
  version: number;
  body: string;
  /** "check yourself" questions; passing (80%+) counts on the reader's onboarding path */
  quiz?: Question[];
  /** where in the system this happens */
  open?: { label: string; href: string }[];
  related?: string[];
};

export type Section = { key: SectionKey; title: string; blurb: string };

export type RolePath = {
  job: JobKey;
  /** what the job is for, in one line */
  purpose: string;
  /** pages to read, in order: week 1 first */
  read: string[];
};
