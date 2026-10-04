ALTER TABLE "MenuItem"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "imageUrl" TEXT;

CREATE INDEX "MenuItem_restaurantId_tenantId_available_active_idx"
ON "MenuItem"("restaurantId", "tenantId", "available", "active");
