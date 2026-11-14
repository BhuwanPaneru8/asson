import type { HandbookPage, RolePath, Section, SectionKey } from "./types";
import { START } from "./content/start";
import { SYSTEM_SELL } from "./content/system-sell";
import { SYSTEM_ORDERS } from "./content/system-orders";
import { SYSTEM_STOCK } from "./content/system-stock";
import { SYSTEM_TEAM } from "./content/system-team";
import { SYSTEM_MONEY } from "./content/system-money";
import { SYSTEM_GROW } from "./content/system-grow";
import { SHOP } from "./content/shop";
import { PROCEDURES } from "./content/procedures";
import { ROLES, ROLE_PATHS } from "./content/roles";
import { HIRING } from "./content/hiring";
import { OWNER } from "./content/owner";
import { WORLDCLASS } from "./content/worldclass";

export const SECTIONS: Section[] = [
  { key: "start", title: "Start here", blurb: "Who we are, how the company runs, and how to use this handbook." },
  { key: "roles", title: "Your job", blurb: "What each job is for, what good looks like, and your first 30 days." },
  { key: "procedures", title: "How we work", blurb: "The daily, weekly and monthly routine, and step-by-step procedures." },
  { key: "system", title: "The system, explained", blurb: "Every part of Asson OS: what it is, why we built it, and how to use it." },
  { key: "shop", title: "The website and app", blurb: "What customers see and can do, so you can help them." },
  { key: "hiring", title: "Hiring and people", blurb: "Recruiting, onboarding, reviews and leaving: the full people process." },
  { key: "owner", title: "Owner and HQ playbooks", blurb: "Running the company: rhythms, targets, new shops, festivals, incidents." },
  { key: "worldclass", title: "World-class review", blurb: "Where Asson OS stands against the best retail systems, and what comes next." },
];

export const PAGES: HandbookPage[] = [
  ...START, ...ROLES, ...PROCEDURES,
  ...SYSTEM_SELL, ...SYSTEM_ORDERS, ...SYSTEM_STOCK, ...SYSTEM_TEAM, ...SYSTEM_MONEY, ...SYSTEM_GROW,
  ...SHOP, ...HIRING, ...OWNER, ...WORLDCLASS,
];

export const PATHS: RolePath[] = ROLE_PATHS;

const BY_SLUG = new Map(PAGES.map((p) => [p.slug, p]));
export const pageBySlug = (slug: string) => BY_SLUG.get(slug);
export const pagesIn = (section: SectionKey) => PAGES.filter((p) => p.section === section);
export const sectionOf = (key: SectionKey) => SECTIONS.find((s) => s.key === key)!;
