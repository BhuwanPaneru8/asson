// Client-safe role → permission map. The ONLY place that decides who can do what.
// Segregation of duties (from the owner's operating rules):
//   Cashier  sells and takes payment; counts stock (blind) but can't change prices, stock or history.
//   Staff    fulfils online orders (picks, packs) and sends/receives stock transfers.
//   Manager  approves discounts ≤ 15%, adjusts stock, closes the day.
//   Owner    (ADMIN) everything, incl. prices, costs & profit, delivery rates, roles and large discounts.
//   Returns always need a manager or owner (cashiers ask for a PIN on the till).

export type StaffRole = "CASHIER" | "STAFF" | "MANAGER" | "ADMIN";
export type Role = StaffRole | "CUSTOMER";

export type Permission =
  | "dashboard"
  | "orders"
  | "catalog.view"
  | "catalog.edit"
  | "inventory.adjust"
  | "customers"
  | "team.manage"
  | "coupons"
  | "delivery"
  | "reviews"
  | "pos.sell"
  | "closing"
  | "approve.discount"
  | "approve.return"
  | "purchasing"
  | "finance"
  | "audit"
  | "transfers"
  | "locations"
  | "system"
  | "insights"
  | "stock.count"
  | "production"
  | "people" // see the team's time, approve leave, fix entries
  | "self.time" // clock in/out and request leave (every staff member)
  | "payroll" // salaries, tax bands, payslips: owner only
  | "ops.manage" // send announcements, set checklists, see every shop's checklists
  | "care"; // customer care queue: answer complaints and order problems

const MAP: Record<StaffRole, Permission[]> = {
  CASHIER: ["pos.sell", "catalog.view", "stock.count", "self.time"],
  STAFF: ["dashboard", "orders", "catalog.view", "reviews", "transfers", "stock.count", "self.time", "care"],
  MANAGER: ["dashboard", "orders", "catalog.view", "inventory.adjust", "customers", "reviews", "pos.sell", "closing", "approve.discount", "approve.return", "purchasing", "transfers", "insights", "stock.count", "production", "people", "self.time", "ops.manage", "care"],
  ADMIN: ["dashboard", "orders", "catalog.view", "catalog.edit", "inventory.adjust", "customers", "team.manage", "coupons", "delivery", "reviews", "pos.sell", "closing", "approve.discount", "approve.return", "purchasing", "finance", "audit", "transfers", "locations", "system", "insights", "stock.count", "production", "people", "self.time", "payroll", "ops.manage", "care"],
};

export const ROLE_LABEL: Record<Role, string> = { CUSTOMER: "Customer", CASHIER: "Cashier", STAFF: "Fulfilment staff", MANAGER: "Manager", ADMIN: "Owner" };

// ---------- jobs and per-person access ----------
// A person's ROLE is their level: it sets discount limits and who can approve what (below). Their JOB decides
// which parts of the system they see. A job is a ready-made set of permissions; the owner can add or remove
// single permissions for one person. Only the owner can manage the team and the system.

/** What each permission lets someone do, in words the owner recognises (the team screen lists these). */
export const PERMISSION_INFO: Record<Permission, { label: string; group: "Selling" | "Orders" | "Stock" | "Team" | "Money" | "Insights" | "Settings" }> = {
  "pos.sell": { label: "Sell at the till", group: "Selling" },
  "approve.discount": { label: "Approve discounts (with their PIN)", group: "Selling" },
  "approve.return": { label: "Approve returns (with their PIN)", group: "Selling" },
  closing: { label: "Close the day, count cash, bank deposits, COD remittance", group: "Selling" },
  dashboard: { label: "Dashboard and Needs attention", group: "Orders" },
  orders: { label: "Online orders, fulfilment, pick lists, notifications", group: "Orders" },
  care: { label: "Customer care queue", group: "Orders" },
  customers: { label: "Customer list and details", group: "Orders" },
  reviews: { label: "Moderate product reviews", group: "Orders" },
  "catalog.view": { label: "See products and stock levels", group: "Stock" },
  "catalog.edit": { label: "Edit products, prices, photos, lookbook, markdowns", group: "Stock" },
  "inventory.adjust": { label: "Adjust stock, damaged stock", group: "Stock" },
  "stock.count": { label: "Count stock, bins", group: "Stock" },
  transfers: { label: "Transfers between shops, replenishment", group: "Stock" },
  purchasing: { label: "Purchase orders, receiving, supplier bills", group: "Stock" },
  production: { label: "Own production (fabric, workshops)", group: "Stock" },
  "self.time": { label: "Today, clock in/out, leave, training, issues", group: "Team" },
  people: { label: "Team time, leave approvals, rosters, missed shifts", group: "Team" },
  "ops.manage": { label: "Announcements, checklists, shop scorecard", group: "Team" },
  payroll: { label: "Payroll, salaries, tax", group: "Money" },
  finance: { label: "Finance: profit, costs, VAT, bank, month close", group: "Money" },
  audit: { label: "Activity log (who changed what)", group: "Money" },
  coupons: { label: "Coupons", group: "Insights" },
  insights: { label: "Insights, KPI pulse, demand forecast, network", group: "Insights" },
  delivery: { label: "Delivery rates", group: "Settings" },
  locations: { label: "Shops and warehouses", group: "Settings" },
  "team.manage": { label: "Manage the team and their access", group: "Settings" },
  system: { label: "System health and background jobs", group: "Settings" },
};
export const PERMISSIONS = Object.keys(PERMISSION_INFO) as Permission[];

/** Only the owner: whoever can change access or the system could give themselves anything. */
export const OWNER_ONLY: Permission[] = ["team.manage", "system"];

export type JobKey = "owner" | "ops-manager" | "shop-manager" | "cashier" | "warehouse" | "care" | "buyer" | "accountant" | "marketing";
export type Job = { key: JobKey; label: string; description: string; role: StaffRole; permissions: Permission[] };

const EVERYONE: Permission[] = ["self.time"];
export const JOBS: Job[] = [
  { key: "owner", label: "Owner", description: "Everything, including the team, prices, costs and payroll.", role: "ADMIN", permissions: MAP.ADMIN },
  { key: "ops-manager", label: "Operations manager", description: "Runs the shops and the warehouse across the network: orders, stock, people, approvals, insights and purchasing. No payroll or finance.", role: "MANAGER", permissions: MAP.MANAGER },
  { key: "shop-manager", label: "Shop manager", description: "Runs one or more shops: the till, approvals, closing and cash, stock, transfers and the shop's team.", role: "MANAGER", permissions: [...EVERYONE, "dashboard", "pos.sell", "approve.discount", "approve.return", "closing", "catalog.view", "inventory.adjust", "stock.count", "transfers", "people", "ops.manage", "care", "orders", "customers"] },
  { key: "cashier", label: "Cashier", description: "Sells at the till and counts stock. Nothing else.", role: "CASHIER", permissions: MAP.CASHIER },
  { key: "warehouse", label: "Warehouse & fulfilment", description: "Picks, packs and ships online orders, moves stock between locations, counts and receives.", role: "STAFF", permissions: [...EVERYONE, "dashboard", "orders", "catalog.view", "transfers", "stock.count"] },
  { key: "care", label: "Customer care", description: "Answers customers: the care queue, orders, customer details and reviews.", role: "STAFF", permissions: [...EVERYONE, "dashboard", "orders", "customers", "care", "reviews", "catalog.view"] },
  { key: "buyer", label: "Buyer / merchandiser", description: "Decides what to stock: products and prices, purchasing, production, markdowns, the demand forecast.", role: "MANAGER", permissions: [...EVERYONE, "dashboard", "catalog.view", "catalog.edit", "purchasing", "production", "insights", "stock.count", "transfers"] },
  { key: "accountant", label: "Accountant", description: "The books: finance, supplier bills and payments, VAT, bank, payroll and the activity log.", role: "MANAGER", permissions: [...EVERYONE, "dashboard", "finance", "purchasing", "payroll", "audit", "closing", "catalog.view"] },
  { key: "marketing", label: "Marketing", description: "Products' words and photos, the lookbook, coupons, reviews and what shoppers search.", role: "STAFF", permissions: [...EVERYONE, "dashboard", "catalog.view", "catalog.edit", "coupons", "reviews", "insights"] },
];
export const jobOf = (key: string | null | undefined) => JOBS.find((j) => j.key === key);

/** The job a person has when none is chosen: the classic one for their role. */
export const defaultJob = (role: StaffRole): JobKey => (role === "ADMIN" ? "owner" : role === "MANAGER" ? "ops-manager" : role === "CASHIER" ? "cashier" : "warehouse");

/**
 * What a person can actually do: their job's permissions (or their role's, when no job is set), plus what the
 * owner added, minus what the owner removed. Owner-only permissions stay with owners whatever is added.
 */
export function effectivePermissions(role: Role, job?: string | null, add: readonly string[] = [], remove: readonly string[] = []): Permission[] {
  if (role === "CUSTOMER") return [];
  if (role === "ADMIN") return [...MAP.ADMIN];
  const base = jobOf(job)?.permissions ?? MAP[role];
  const set = new Set<Permission>(base);
  for (const p of add) if ((PERMISSIONS as string[]).includes(p)) set.add(p as Permission);
  for (const p of remove) set.delete(p as Permission);
  for (const p of OWNER_ONLY) set.delete(p);
  set.add("self.time"); // every staff member can clock in and see Today
  return PERMISSIONS.filter((p) => set.has(p));
}

/** Who's asking: a role (older call sites, tests) or a signed-in person with their worked-out permissions. */
export type Subject = Role | { role: Role | string; permissions?: readonly Permission[] | null } | null | undefined;

export function can(who: Subject, p: Permission) {
  if (!who) return false;
  if (typeof who === "string") return who !== "CUSTOMER" && MAP[who].includes(p);
  if (who.role === "CUSTOMER") return false;
  if (who.permissions) return who.permissions.includes(p);
  // no worked-out permissions passed (an actor built elsewhere): fall back to the classic set for the role
  return who.role in MAP && MAP[who.role as StaffRole].includes(p);
}

export const isStaffRole = (role: Role | null | undefined): role is StaffRole => !!role && role !== "CUSTOMER";

/** Largest discount (as % of the sale) a role may give without someone else's approval. */
export function discountLimitPercent(role: Role): number {
  return role === "ADMIN" ? 100 : role === "MANAGER" ? 15 : role === "CASHIER" ? 5 : 0;
}

/** Where a staff member lands in the admin: the till for cashiers, else the dashboard, else Today. */
export function homeFor(who: Subject) {
  if (can(who, "pos.sell") && !can(who, "dashboard")) return "/admin/pos";
  return can(who, "dashboard") ? "/admin" : "/admin/today";
}
