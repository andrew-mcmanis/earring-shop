// The one delivery formula: a single flat base price covers the first item,
// and every additional item in the basket adds half the base. The cart
// estimate, the checkout summary, and the authoritative computation in
// placeOrder all call this — change the rule here and every surface (including
// Phase 2's Stripe amount) stays in step.
//
// Example, base £2: 1 item → £2, 2 items → £3, 3 items → £4.

/** Each additional item after the first costs this fraction of the base. */
export const ADDITIONAL_ITEM_RATE = 0.5;

export function computeShipping(itemCount: number, base: number): number {
  if (itemCount <= 0 || base <= 0) return 0;
  // Work in whole pennies so half-base and totals never drift sub-penny.
  const basePennies = Math.round(base * 100);
  const additionalEach = Math.round(basePennies * ADDITIONAL_ITEM_RATE);
  const totalPennies = basePennies + Math.max(0, itemCount - 1) * additionalEach;
  return totalPennies / 100;
}
