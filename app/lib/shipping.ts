// The one shipping formula: each line is charged its category's delivery rate
// (× quantity), summed across the basket. The cart estimate, the checkout
// summary, and the authoritative computation in placeOrder all call this —
// change the pricing rule here and every surface (including Phase 2's Stripe
// amount) stays in step.

export interface ShippingLine {
  categorySlug: string;
  qty: number;
}

export function computeShipping(
  lines: ShippingLine[],
  rates: Record<string, number>,
): number {
  return lines.reduce((sum, l) => sum + (rates[l.categorySlug] ?? 0) * l.qty, 0);
}
