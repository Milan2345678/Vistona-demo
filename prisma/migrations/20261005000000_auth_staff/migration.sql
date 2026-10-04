ALTER TABLE "User"
ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StaffInvite" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffInvite_tokenHash_key" ON "StaffInvite"("tokenHash");
CREATE INDEX "StaffInvite_tenantId_restaurantId_expiresAt_idx"
ON "StaffInvite"("tenantId", "restaurantId", "expiresAt");

ALTER TABLE "StaffInvite"
ADD CONSTRAINT "StaffInvite_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffInvite"
ADD CONSTRAINT "StaffInvite_restaurantId_tenantId_fkey"
FOREIGN KEY ("restaurantId", "tenantId") REFERENCES "Restaurant"("id", "tenantId")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StaffInvite"
ADD CONSTRAINT "StaffInvite_createdById_tenantId_fkey"
FOREIGN KEY ("createdById", "tenantId") REFERENCES "User"("id", "tenantId")
ON DELETE CASCADE ON UPDATE CASCADE;
