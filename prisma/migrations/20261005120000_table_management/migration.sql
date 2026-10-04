ALTER TABLE "RestaurantTable"
ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "publicQrToken" TEXT;

UPDATE "RestaurantTable"
SET "publicQrToken" = gen_random_uuid()::text
WHERE "publicQrToken" IS NULL;

ALTER TABLE "RestaurantTable"
ALTER COLUMN "publicQrToken" SET DEFAULT gen_random_uuid()::text,
ALTER COLUMN "publicQrToken" SET NOT NULL;

CREATE UNIQUE INDEX "RestaurantTable_publicQrToken_key"
ON "RestaurantTable"("publicQrToken");

CREATE INDEX "RestaurantTable_restaurantId_tenantId_active_idx"
ON "RestaurantTable"("restaurantId", "tenantId", "active");
