# Vistona Restaurant CRM / KOT SaaS

This repository is the Restaurant CRM and KOT system for multi-tenant restaurant operations. It is intentionally focused on SaaS-style restaurant management and not the older Vistona public website or bottle business project.

## Phase 1 product scope

- Restaurant and tenant architecture
- Authentication and RBAC
- Waiter dashboard
- Kitchen dashboard
- KOT workflow
- QR ordering
- Manual waiter-created orders
- Unified order lifecycle
- Realtime updates where required

## Product architecture

The application follows a tenant-first SaaS model:

- Each restaurant is treated as an isolated tenant in the platform.
- Core transactional data should live in PostgreSQL, with per-tenant row-level security or scoped queries.
- The Next.js/React/TypeScript frontend remains the operating layer for manager, waiter, and kitchen roles.
- Order events should flow through a single lifecycle from `New -> Preparing -> Ready -> Served -> Completed`.
- QR orders, manual waiter orders, and POS orders all share the same unified order ledger.

## Recommended data model

```text
tenants
  id
  name
  city
  plan
  status

users
  id
  tenant_id
  role
  name
  email

restaurants
  id
  tenant_id
  name
  timezone
  location

tables
  id
  restaurant_id
  number
  seats
  status

menu_items
  id
  restaurant_id
  name
  category
  price
  vegetarian
  available

orders
  id
  restaurant_id
  table_id
  user_id
  source (qr | waiter | pos)
  status
  total_amount
  created_at

order_items
  id
  order_id
  menu_item_id
  quantity
  price

kot_events
  id
  order_id
  status
  actor_id
  created_at
```

## Implemented workflows

- **Authentication and tenant isolation:** restaurant owners can create a tenant, restaurant, and manager account at `/signup`. Managers create waiter and kitchen accounts directly or issue single-use invitations at `/manager/staff`; staff accept invitations at `/join`. Signed-in users can update account details at `/account`.
- **Role-based operations:** managers, waiters, and kitchen staff have protected dashboards at `/manager/dashboard`, `/waiter/dashboard`, and `/kitchen/dashboard`. API queries are scoped to the signed-in user's tenant and restaurant.
- **Tables and QR codes:** managers can create, edit, and deactivate tables. Each table has a stable public QR token; changing its number does not invalidate printed QR codes. Waiters can view active tables and update table status.
- **Menu management:** managers manage dishes and categories at `/manager/menu`. Menu items support descriptions, prices, vegetarian labels, availability, and optional image URLs. Removing a dish is a soft delete to preserve order history.
- **Orders and KOT:** QR, waiter, and POS orders share an order lifecycle and server-derived pricing. Role-checked transitions update KOT tickets and record events. The dashboard refreshes data by polling the API.
- **Customer QR ordering:** customers can view a restaurant menu and place an order from `/menu/{restaurantSlug}/table/{tableToken}`. The server resolves the table from its opaque token rather than trusting a submitted table number.
- **Payments:** Razorpay order creation, payment verification, and webhook routes are available under `/api/payments`.

Staff invitations expire after seven days and store only a hash of the invite code. Password changes, staff role changes, and staff deactivation invalidate existing sessions.

## Local development

Create `.env.local` with a PostgreSQL connection string and a random session secret of at least 32 characters:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/vistona"
JWT_SECRET="replace-with-a-random-secret-at-least-32-characters-long"
DEMO_PASSWORD="demo123"
```

Apply the initial schema and seed development demo users:

```bash
npm run db:migrate
npm run db:seed
```

The seed creates an Anndham tenant with `manager@vistona.local`, `waiter@vistona.local`, and `kitchen@vistona.local`, plus a separate Milan tenant with `milan@vistona.local`. All seed accounts share `DEMO_PASSWORD` (defaults to `demo123`); use them only in a local development database. The Milan fixture has distinct table/menu records for tenant-isolation checks and is not an onboarding mechanism.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Real account onboarding

The seeded users are development fixtures only. Normal onboarding begins at `/signup`, which creates a new tenant, restaurant, and manager account. Managers can add waiter/kitchen accounts from `/manager/staff` or generate a seven-day, single-use invite; staff join at `/join`. Any signed-in user can update their name or password at `/account`.

Apply schema migrations and regenerate the Prisma client before first use:

```bash
npm run db:generate
npm run db:migrate
```

These commands target the database selected by `DATABASE_URL`; verify it points at a development database before applying migrations. `npm run db:seed` remains available for local demos and tenant-isolation fixtures, but is not required for real account signup.

The auth/staff migration adds `User.authVersion` and a tenant/restaurant-scoped `StaffInvite` table. Invites persist only a hash of the random code. Password changes, staff role changes, and deactivation invalidate prior session versions.

Managers can manage restaurant tables from the dashboard's Tables section. Table creation, editing, and removal are server-scoped to the manager's tenant/restaurant; removal deactivates the row so historical orders remain attached. The table migration adds `active` and a stable database-generated `publicQrToken`. Managers can preview/download QR images locally; editing the table number or seat count does not change the token. Waiters see active tables only.

The shared restaurant menu is managed at `/manager/menu` and read by both manager and waiter accounts. Dishes use dynamic restaurant categories, in-stock state, optional image URLs, server-derived restaurant scope, and soft removal so historical order snapshots remain intact. Public customer pages are `/menu/{restaurantSlug}/table/{tableToken}`; their QR menu/order API resolves the table from the opaque token, never from a client-submitted table number. New restaurants start without tables or menu dishes, so managers must add those before waiter or QR ordering.

## Verification

```bash
npm test
npm run lint
npm run build
```

## API overview

- **Authentication:** `POST /api/auth/signup`, `/api/auth/join`, `/api/auth/login`, `/api/auth/logout`, and `/api/auth/change-password`; `GET /api/auth/session` and `/api/auth/account`; `PATCH /api/auth/account`.
- **Staff:** `GET` and `POST /api/staff`; `PATCH` and `DELETE /api/staff/{staffId}`; `POST /api/staff/invite`.
- **Restaurant and tables:** `GET /api/restaurant`; `POST /api/restaurant/tables`; `PATCH` and `DELETE /api/restaurant/tables/{tableId}`; `PATCH /api/restaurant/tables/{tableId}/status`.
- **Menu:** `GET` and `POST /api/restaurant/menu`; `PATCH` and `DELETE /api/restaurant/menu/{menuItemId}`; `PATCH /api/restaurant/menu/{menuItemId}/availability`.
- **Orders and KOT:** `GET` and `POST /api/orders`; `PATCH /api/orders/{orderId}/status`. Waiter/POS prices are calculated from menu records on the server, and order creation writes the initial KOT in a transaction.
- **QR ordering:** `GET /api/qr/{restaurantSlug}/menu` and `POST /api/qr/{restaurantSlug}/orders` are public endpoints that use the table's QR token.
- **Payments:** `POST /api/payments/create-order`, `/api/payments/verify`, and `/api/payments/webhook`.

All migrations are in `prisma/migrations`. Generate the Prisma client with `npm run db:generate`, then apply migrations with `npm run db:migrate`. These commands use the database configured through `DATABASE_URL`; verify the target before applying migrations. `prisma.config.ts` loads `.env.local` for local development. The SQL migrations are checked in, so deployment does not depend on downloading Prisma's schema engine at runtime.
