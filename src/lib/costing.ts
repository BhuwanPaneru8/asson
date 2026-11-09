// Pure costing rules — shared by purchasing and reports. All money in paisa.

/** Spread a PO's freight/customs over its lines by value → landed cost per unit. */
export function landedUnitCost(unitCost: number, landedCost: number, poGoodsValue: number) {
  if (!landedCost || !poGoodsValue) return unitCost;
  return Math.round(unitCost + (landedCost * unitCost) / poGoodsValue);
}

/** Weighted-average cost after receiving `qty` units at `unitCost` onto `stock` units at `oldCost`. */
export function weightedAverageCost(stock: number, oldCost: number | null, qty: number, unitCost: number) {
  const on = Math.max(0, stock);
  if (oldCost == null || on === 0) return unitCost;
  return Math.round((on * oldCost + qty * unitCost) / (on + qty));
}

export function marginPercent(revenue: number, cost: number) {
  return revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0;
}

/** Refund share per unit: each unit gives back what was actually paid for it (order discount spread by value). */
export function refundPerUnit(unitPrice: number, subtotal: number, discount: number) {
  if (!subtotal) return unitPrice;
  return Math.floor((unitPrice * (subtotal - discount)) / subtotal);
}
