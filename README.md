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
