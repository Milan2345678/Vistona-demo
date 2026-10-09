# Vistona Restaurant CRM

Vistona Beta 2.0 is a multi-tenant restaurant operations app for managers, waiters, and kitchen staff. It combines restaurant setup, table and menu management, dine-in and takeaway order entry, kitchen order tickets (KOT), QR customer ordering, billing, and staff accounts.

## What is implemented

- **Manager dashboard:** restaurant overview, tables, orders, reports, billing settings, menu management, and staff management.
- **Waiter dashboard:** view active tables and orders, change table status, enter waiter or walk-in/POS orders, record cash or UPI payments, and download receipts.
- **Kitchen dashboard:** follow KOTs through New, Preparing, and Ready; order status changes update the ticket and record KOT events.
- **Menu and tables:** managers create and update menu categories, dishes, availability, and tables. Deleting a dish or table deactivates it so order history remains intact. Tables have stable QR tokens.
- **QR ordering:** customers open a restaurant menu, submit orders for the table identified by its QR token, track that order, download a bill, and request a bill or water from staff.
- **Restaurant branding:** managers configure a public HTTPS logo URL and primary/accent colors used by that restaurant's QR menu.
- **Expense management:** managers record categorized expenses, review up to 500 recent entries, and filter totals by category and date. Entries are scoped to the signed-in restaurant and record their creator; expenses are not linked to a BusinessDay because that model is not present.
- **Billing and payments:** each order stores its tax calculation; managers configure GST rate and whether menu prices include GST. Staff can record cash or UPI. Optional Razorpay checkout uses signed checkout verification and a webhook.
- **Staff and roles:** managers create waiter/kitchen accounts or issue single-use, seven-day invites. Staff can join through an invite. Password changes, role changes, and deactivation invalidate existing sessions.

There is no standalone KOT API. KOT tickets and events are created with an order and updated as order statuses change.

## Stack and data access

- Next.js 16 App Router, React 19, TypeScript, and Tailwind CSS.
- PostgreSQL hosted by Supabase.
- `pg` is the runtime SQL client used by most API handlers.
- Prisma 7 with `@prisma/adapter-pg` is used by the payment API and by Prisma migration/generation commands. The generated Prisma client is under `src/generated/prisma`.
- The app has its own HMAC-signed `vistona_session` cookie and bcrypt password hashes. It does not use Supabase Auth or a Supabase JavaScript client. Protected API handlers re-check the active user and session version in PostgreSQL.
- Tenant and restaurant scope comes from the verified session and is included in protected queries. Public QR endpoints use a restaurant slug and table QR token to scope customer actions.

## Local development

Use Node.js and npm. Create a local `.env.local` file with the variables listed below; keep its values private and out of version control.

```text
DATABASE_URL
JWT_SECRET
RAZORPAY_KEY_ID       # optional; required for online checkout
RAZORPAY_KEY_SECRET   # optional; required for online checkout
RAZORPAY_WEBHOOK_SECRET # optional; required for online checkout
DEMO_PASSWORD         # optional; used by the development seed
```

`JWT_SECRET` must contain at least 32 characters. Configure Razorpay's `payment.captured` webhook to call `/api/payments/webhook` on the deployed app when online checkout is enabled. Never expose server environment variables to browser code.

Install dependencies, generate Prisma Client, apply pending migrations to the database named by `DATABASE_URL`, and start Next.js:

```sh
npm ci
npm run db:generate
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. `npm run db:migrate` runs `prisma migrate deploy`; it applies checked-in migrations and does not reset the database. `prisma.config.ts` loads `.env.local` for local Prisma CLI commands. Confirm `DATABASE_URL` points to the intended database before applying migrations.

For an optional local demo dataset, run `npm run db:seed` after migrations. The seed creates Anndham and Milan development fixtures; it is not required for normal signup and should not be used as a production onboarding path. Normal onboarding starts at `/signup`.

## Database changes and deployment

Schema changes are represented by SQL migrations in `prisma/migrations`. Before deploying an application version that depends on a new schema, configure the target environment's private `DATABASE_URL`, then run:

```sh
npm run db:generate
npm run db:migrate
npm run build
```

Use the connection string copied from the Supabase dashboard for the environment where the app runs. Run migrations as a controlled release step against the intended database. Do not use `prisma migrate reset` for deployment. Set `JWT_SECRET` and, when using Razorpay, all three Razorpay variables in the server's environment settings. Deploy the Next.js app with a Node.js runtime for the PostgreSQL, password-hashing, PDF, and payment code.

Useful local checks:

```sh
npm test
npm run lint
npm run build
```

## Project layout

- `src/app/` — pages, role dashboards, customer QR pages, and App Router API endpoints.
- `src/app/api/auth/` — signup, login, logout, session, account, and password routes.
- `src/app/api/restaurant/`, `src/app/api/staff/`, `src/app/api/orders/` — restaurant administration, staff, order/KOT, billing, and reports.
- `src/app/api/qr/` — public menu, QR ordering, order tracking, bills, and table service requests.
- `src/app/api/expenses/` and `src/app/manager/expenses/` — manager expense history, filters, summaries, and entry.
- `src/app/api/restaurant/branding/` and `src/app/manager/branding/` — manager restaurant logo and color settings.
- `src/app/api/payments/` — Razorpay order creation, verification, and webhook handling.
- `src/lib/` — PostgreSQL pool, session checks, order logic, billing, and payment helpers.
- `prisma/schema.prisma`, `prisma/migrations/` — Prisma data model and PostgreSQL migrations.
- `postman/` — API collection and local API testing notes.

Most API routes are protected independently of the dashboard UI. See [the Postman guide](postman/README.md) for the route groups and collection workflow.
