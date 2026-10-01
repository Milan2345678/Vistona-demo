CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'WAITER', 'KITCHEN');
CREATE TYPE "OrderSource" AS ENUM ('QR', 'WAITER', 'POS');
CREATE TYPE "OrderStatus" AS ENUM ('NEW', 'PREPARING', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED');
CREATE TYPE "TableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'BILLING');

CREATE TABLE "Tenant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Restaurant" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  city TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Restaurant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE,
  CONSTRAINT "Restaurant_id_tenantId_key" UNIQUE (id, "tenantId")
);
CREATE INDEX "Restaurant_tenantId_idx" ON "Restaurant"("tenantId");

CREATE TABLE "User" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  role "UserRole" NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"(id) ON DELETE CASCADE,
  CONSTRAINT "User_restaurantId_tenantId_fkey" FOREIGN KEY ("restaurantId", "tenantId") REFERENCES "Restaurant"(id, "tenantId") ON DELETE CASCADE,
  CONSTRAINT "User_id_tenantId_key" UNIQUE (id, "tenantId")
);
CREATE INDEX "User_restaurantId_tenantId_idx" ON "User"("restaurantId", "tenantId");

CREATE TABLE "RestaurantTable" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  number TEXT NOT NULL,
  seats INTEGER NOT NULL,
  status "TableStatus" NOT NULL DEFAULT 'AVAILABLE',
  CONSTRAINT "RestaurantTable_restaurantId_tenantId_fkey" FOREIGN KEY ("restaurantId", "tenantId") REFERENCES "Restaurant"(id, "tenantId") ON DELETE CASCADE,
  CONSTRAINT "RestaurantTable_id_restaurantId_tenantId_key" UNIQUE (id, "restaurantId", "tenantId"),
  CONSTRAINT "RestaurantTable_restaurantId_tenantId_number_key" UNIQUE ("restaurantId", "tenantId", number)
);

CREATE TABLE "MenuCategory" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  name TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MenuCategory_restaurantId_tenantId_fkey" FOREIGN KEY ("restaurantId", "tenantId") REFERENCES "Restaurant"(id, "tenantId") ON DELETE CASCADE,
  CONSTRAINT "MenuCategory_id_restaurantId_tenantId_key" UNIQUE (id, "restaurantId", "tenantId"),
  CONSTRAINT "MenuCategory_restaurantId_tenantId_name_key" UNIQUE ("restaurantId", "tenantId", name)
);

CREATE TABLE "MenuItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price DECIMAL(10,2) NOT NULL,
  vegetarian BOOLEAN NOT NULL DEFAULT false,
  available BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MenuItem_restaurantId_tenantId_fkey" FOREIGN KEY ("restaurantId", "tenantId") REFERENCES "Restaurant"(id, "tenantId") ON DELETE CASCADE,
  CONSTRAINT "MenuItem_categoryId_restaurantId_tenantId_fkey" FOREIGN KEY ("categoryId", "restaurantId", "tenantId") REFERENCES "MenuCategory"(id, "restaurantId", "tenantId") ON DELETE RESTRICT,
  CONSTRAINT "MenuItem_id_restaurantId_tenantId_key" UNIQUE (id, "restaurantId", "tenantId"),
  CONSTRAINT "MenuItem_restaurantId_tenantId_name_key" UNIQUE ("restaurantId", "tenantId", name)
);
CREATE INDEX "MenuItem_restaurantId_tenantId_available_idx" ON "MenuItem"("restaurantId", "tenantId", available);

CREATE TABLE "Order" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number INTEGER NOT NULL,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "tableId" TEXT,
  "userId" TEXT,
  source "OrderSource" NOT NULL,
  status "OrderStatus" NOT NULL DEFAULT 'NEW',
  notes TEXT NOT NULL DEFAULT '',
  "totalAmount" DECIMAL(10,2) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Order_restaurantId_tenantId_fkey" FOREIGN KEY ("restaurantId", "tenantId") REFERENCES "Restaurant"(id, "tenantId") ON DELETE CASCADE,
  CONSTRAINT "Order_tableId_restaurantId_tenantId_fkey" FOREIGN KEY ("tableId", "restaurantId", "tenantId") REFERENCES "RestaurantTable"(id, "restaurantId", "tenantId") ON DELETE RESTRICT,
  CONSTRAINT "Order_userId_tenantId_fkey" FOREIGN KEY ("userId", "tenantId") REFERENCES "User"(id, "tenantId") ON DELETE RESTRICT,
  CONSTRAINT "Order_id_restaurantId_tenantId_key" UNIQUE (id, "restaurantId", "tenantId"),
  CONSTRAINT "Order_restaurantId_tenantId_number_key" UNIQUE ("restaurantId", "tenantId", number)
);
CREATE INDEX "Order_restaurantId_tenantId_status_createdAt_idx" ON "Order"("restaurantId", "tenantId", status, "createdAt");

CREATE TABLE "OrderItem" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "menuItemId" TEXT NOT NULL,
  "itemName" TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  "unitPrice" DECIMAL(10,2) NOT NULL,
  CONSTRAINT "OrderItem_orderId_restaurantId_tenantId_fkey" FOREIGN KEY ("orderId", "restaurantId", "tenantId") REFERENCES "Order"(id, "restaurantId", "tenantId") ON DELETE CASCADE,
  CONSTRAINT "OrderItem_menuItemId_restaurantId_tenantId_fkey" FOREIGN KEY ("menuItemId", "restaurantId", "tenantId") REFERENCES "MenuItem"(id, "restaurantId", "tenantId") ON DELETE RESTRICT
);
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

CREATE TABLE "KotTicket" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL UNIQUE,
  status "OrderStatus" NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KotTicket_orderId_restaurantId_tenantId_fkey" FOREIGN KEY ("orderId", "restaurantId", "tenantId") REFERENCES "Order"(id, "restaurantId", "tenantId") ON DELETE CASCADE,
  CONSTRAINT "KotTicket_id_restaurantId_tenantId_key" UNIQUE (id, "restaurantId", "tenantId")
);

CREATE TABLE "KotEvent" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "restaurantId" TEXT NOT NULL,
  "ticketId" TEXT NOT NULL,
  "actorId" TEXT,
  status "OrderStatus" NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "KotEvent_ticketId_restaurantId_tenantId_fkey" FOREIGN KEY ("ticketId", "restaurantId", "tenantId") REFERENCES "KotTicket"(id, "restaurantId", "tenantId") ON DELETE CASCADE,
  CONSTRAINT "KotEvent_actorId_tenantId_fkey" FOREIGN KEY ("actorId", "tenantId") REFERENCES "User"(id, "tenantId") ON DELETE RESTRICT
);
CREATE INDEX "KotEvent_ticketId_createdAt_idx" ON "KotEvent"("ticketId", "createdAt");