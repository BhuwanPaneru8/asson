import "server-only";
import type { CurrentUser } from "./auth";
import { can } from "./permissions";

/** Account orders: owner or staff only. Guest orders: anyone holding the unguessable order id. */
export function canViewOrder(order: { userId: string | null }, user: CurrentUser | null) {
  if (!order.userId) return true;
  if (!user) return false;
  return user.id === order.userId || can(user, "orders");
}
