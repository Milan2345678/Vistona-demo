ALTER TABLE "Order"
ADD COLUMN "customerName" TEXT,
ADD COLUMN "customerPhone" TEXT;

CREATE TABLE "TableServiceRequest" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "tableId" TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('BILL', 'WATER')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'DONE')),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TableServiceRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE,
  CONSTRAINT "TableServiceRequest_restaurantId_tenantId_fkey"
    FOREIGN KEY ("restaurantId", "tenantId")
    REFERENCES "Restaurant"(id, "tenantId") ON DELETE CASCADE,
  CONSTRAINT "TableServiceRequest_tableId_restaurantId_tenantId_fkey"
    FOREIGN KEY ("tableId", "restaurantId", "tenantId")
    REFERENCES "RestaurantTable"(id, "restaurantId", "tenantId") ON DELETE CASCADE
);

CREATE INDEX "TableServiceRequest_restaurantId_tenantId_status_createdAt_idx"
ON "TableServiceRequest"("restaurantId", "tenantId", status, "createdAt");

CREATE UNIQUE INDEX "TableServiceRequest_one_open_per_table_type_key"
ON "TableServiceRequest"("tableId", type)
WHERE status = 'OPEN';
