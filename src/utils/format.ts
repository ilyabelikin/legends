/**
 * Formats a quantity for display, rounding to 1 decimal place.
 */
export function formatQuantity(quantity: number): string {
  return (Math.round(quantity * 10) / 10).toFixed(1);
}
