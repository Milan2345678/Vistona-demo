export const EXPENSE_CATEGORIES = [
  "FOOD_RAW_MATERIALS",
  "STAFF",
  "RENT",
  "ELECTRICITY",
  "GAS",
  "MAINTENANCE",
  "PACKAGING",
  "DELIVERY",
  "MARKETING",
  "OTHER",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  FOOD_RAW_MATERIALS: "Food / raw materials",
  STAFF: "Staff",
  RENT: "Rent",
  ELECTRICITY: "Electricity",
  GAS: "Gas",
  MAINTENANCE: "Maintenance",
  PACKAGING: "Packaging",
  DELIVERY: "Delivery",
  MARKETING: "Marketing",
  OTHER: "Other",
};

export const EXPENSE_PAYMENT_METHODS = [
  "CASH",
  "UPI",
  "CARD",
  "BANK_TRANSFER",
  "OTHER",
] as const;

export type ExpensePaymentMethod = (typeof EXPENSE_PAYMENT_METHODS)[number];

export const EXPENSE_PAYMENT_METHOD_LABELS: Record<
  ExpensePaymentMethod,
  string
> = {
  CASH: "Cash",
  UPI: "UPI",
  CARD: "Card",
  BANK_TRANSFER: "Bank transfer",
  OTHER: "Other",
};

export function isExpenseDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
