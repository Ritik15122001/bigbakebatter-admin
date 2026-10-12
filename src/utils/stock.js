/** Low-stock threshold — must match the backend's adjustStock rule. */
export const LOW_STOCK_AT = 6;

/** Stock status derived from quantity: 0 → Out of stock, ≤6 → Low stock, else In stock. */
export function stockFromQty(qty) {
  const n = Number(qty) || 0;
  if (n <= 0) return 'Out of stock';
  if (n <= LOW_STOCK_AT) return 'Low stock';
  return 'In stock';
}

export function stockTone(status) {
  if (status === 'Out of stock') return 'err';
  if (status === 'Low stock') return 'warn';
  return 'success';
}
