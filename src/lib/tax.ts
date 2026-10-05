export type TaxBreakdown = {
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export function calculateTax(
  amountCents: number,
  rate: number,
  inclusive: boolean,
): TaxBreakdown {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new RangeError("Amount must be a non-negative integer in cents");
  }
  if (!Number.isFinite(rate) || rate < 0 || rate > 28) {
    throw new RangeError("Tax rate must be between 0 and 28 percent");
  }

  const taxCents = inclusive
    ? Math.round((amountCents * rate) / (100 + rate))
    : Math.round((amountCents * rate) / 100);
  return inclusive
    ? {
        subtotalCents: amountCents - taxCents,
        taxCents,
        totalCents: amountCents,
      }
    : {
        subtotalCents: amountCents,
        taxCents,
        totalCents: amountCents + taxCents,
      };
}
