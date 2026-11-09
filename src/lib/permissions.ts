// Client-safe role → permission map. The ONLY place that decides who can do what.
// Segregation of duties (from the owner's operating rules):
//   Cashier  sells and takes payment; can't change prices, stock or history.
//   Staff    fulfils online orders.
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
  | "audit";

const MAP: Record<StaffRole, Permission[]> = {
  CASHIER: ["pos.sell", "catalog.view"],
  STAFF: ["dashboard", "orders", "catalog.view", "reviews"],
  MANAGER: ["dashboard", "orders", "catalog.view", "inventory.adjust", "customers", "reviews", "pos.sell", "closing", "approve.discount", "approve.return", "purchasing"],
  ADMIN: ["dashboard", "orders", "catalog.view", "catalog.edit", "inventory.adjust", "customers", "team.manage", "coupons", "delivery", "reviews", "pos.sell", "closing", "approve.discount", "approve.return", "purchasing", "finance", "audit"],
};

export const ROLE_LABEL: Record<Role, string> = { CUSTOMER: "Customer", CASHIER: "Cashier", STAFF: "Fulfilment staff", MANAGER: "Manager", ADMIN: "Owner" };

export function can(role: Role | null | undefined, p: Permission) {
  if (!role || role === "CUSTOMER") return false;
  return MAP[role].includes(p);
}

export const isStaffRole = (role: Role | null | undefined): role is StaffRole => !!role && role !== "CUSTOMER";

/** Largest discount (as % of the sale) a role may give without someone else's approval. */
export function discountLimitPercent(role: Role): number {
  return role === "ADMIN" ? 100 : role === "MANAGER" ? 15 : role === "CASHIER" ? 5 : 0;
}

/** Where a staff member lands in the admin. */
export function homeFor(role: StaffRole) {
  return role === "CASHIER" ? "/admin/pos" : "/admin";
}
