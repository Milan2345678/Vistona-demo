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

## Current app status

The existing UI has been extended to reflect the SaaS operating model without replacing the working restaurant flow. The app now includes:

- tenant selection in the sidebar
- role-based dashboard context
- QR/manual/POS source visibility on orders
- KOT lifecycle awareness in the dashboard and order details
- tenant RBAC summary in settings

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

After pulling schema changes, run `npm run db:migrate` to apply pending migrations before restarting the app.

## Managing the restaurant menu

Sign in as a manager and open `/manager/menu`. Use **Add New Dish** to create dishes individually, or **Import CSV** to add up to 100 dishes in one atomic import. The CSV requires `name`, `category`, and `price` columns; `description`, `vegetarian`, `available`, and `imageUrl` are optional. Boolean values accept `true`/`false`, `yes`/`no`, or `1`/`0`. Download the template from the import dialog for the exact header row.

## Customer order tracking and online payments

QR customers see a default 30-minute ready-time estimate and the current order status. The page refreshes status automatically while it remains open. Online checkout uses Razorpay; configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the server environment and configure Razorpay's `payment.captured` webhook to `https://<domain>/api/payments/webhook`. Customers can also choose to pay at the restaurant.

QR orders can include a customer name, mobile number, and kitchen preferences/instructions. Customers can download a PDF receipt or send bill/water requests from the order confirmation. Staff can review and mark those table requests complete from the Orders or QR Orders screen.

The auth/staff migration adds `User.authVersion` and a tenant/restaurant-scoped `StaffInvite` table. Invites persist only a hash of the random code. Password changes, staff role changes, and deactivation invalidate prior session versions.

Managers can manage restaurant tables from the dashboard's Tables section. Table creation, editing, and removal are server-scoped to the manager's tenant/restaurant; removal deactivates the row so historical orders remain attached. The table migration adds `active` and a stable database-generated `publicQrToken`. Managers can preview/download QR images locally; editing the table number or seat count does not change the token. Waiters see active tables only.

The shared restaurant menu is managed at `/manager/menu` and read by both manager and waiter accounts. Dishes use dynamic restaurant categories, in-stock state, optional image URLs, server-derived restaurant scope, and soft removal so historical order snapshots remain intact. Public customer pages are `/menu/{restaurantSlug}/table/{tableToken}`; their QR menu/order API resolves the table from the opaque token, never from a client-submitted table number. New restaurants start without tables or menu dishes, so managers must add those before waiter or QR ordering.

## Verification

```bash
npm test
npm run lint
npm run build
```

## Phase 1 API

- `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout` manage signed, HTTP-only sessions.
- `GET /api/restaurant` and `GET /api/orders` are scoped to the authenticated tenant and restaurant.
- `POST /api/orders` creates waiter/POS orders with server-derived prices and an initial KOT in one transaction.
- `PATCH /api/orders/{orderId}/status` applies role-checked lifecycle transitions and records KOT events.
- `GET /api/qr/{restaurantSlug}/menu` and `POST /api/qr/{restaurantSlug}/orders` provide the public QR ordering flow.

Apply `prisma/migrations` to a PostgreSQL database before starting the application. The SQL migration is included for environments where Prisma's schema engine cannot be downloaded.
