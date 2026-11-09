import type { OrderStatus } from "@prisma/client";

// Shared by server and client code (labels, allowed transitions).
export const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Order placed",
  CONFIRMED: "Confirmed",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RETURN_REQUESTED: "Return requested",
  RETURNED: "Returned",
};

/** The fulfilment state machine. Anything not listed here is rejected. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["OUT_FOR_DELIVERY", "DELIVERED"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED", "DELIVERED"],
  CANCELLED: [],
  RETURNED: [],
};

/** Click-and-collect: packed means it's waiting at the shop; handing it over is the "delivery". */
export const PICKUP_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  ...TRANSITIONS,
  PACKED: ["DELIVERED", "CANCELLED"],
  SHIPPED: [],
  OUT_FOR_DELIVERY: [],
};

export const PICKUP_LABEL: Partial<Record<OrderStatus, string>> = { PACKED: "Ready for pickup", DELIVERED: "Collected" };

export const transitionsFor = (status: OrderStatus, pickup: boolean) => (pickup ? PICKUP_TRANSITIONS : TRANSITIONS)[status];
export const statusLabel = (status: OrderStatus, pickup: boolean) => (pickup && PICKUP_LABEL[status]) || STATUS_LABEL[status];

export const CUSTOMER_CANCELLABLE: OrderStatus[] = ["PENDING", "CONFIRMED"];

