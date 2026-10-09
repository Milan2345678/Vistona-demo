CREATE TABLE "Expense" (
  id TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  "expenseDate" DATE NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Expense_pkey" PRIMARY KEY (id),
  CONSTRAINT "Expense_restaurantId_tenantId_fkey"
    FOREIGN KEY ("restaurantId", "tenantId")
    REFERENCES "Restaurant"(id, "tenantId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Expense_createdById_tenantId_fkey"
    FOREIGN KEY ("createdById", "tenantId")
    REFERENCES "User"(id, "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Expense_tenantId_restaurantId_expenseDate_idx"
  ON "Expense"("tenantId", "restaurantId", "expenseDate");
