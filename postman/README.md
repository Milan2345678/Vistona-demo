# Vistona API and Postman guide

The Postman collection exercises the implemented Next.js API routes. It does not call Supabase PostgREST directly; the application routes access PostgreSQL server-side. Import `Vistona-API.postman_collection.json` and set its `baseUrl` to the local app, normally `http://localhost:3000`.

## Run locally

1. Follow the setup in the [project README](../README.md), including creating `.env.local`, generating Prisma Client, and applying migrations to the intended development database.
2. Start the app with `npm run dev`.
3. Run the signup request in the collection to create a manager and restaurant, then create a table and menu item before testing waiter or QR orders.
4. Use the collection's logout and login requests to test manager, waiter, and kitchen access. Postman keeps the `vistona_session` cookie in its cookie jar; use the same hostname throughout (`localhost` and `127.0.0.1` have separate cookie jars).
5. Payment requests that contact Razorpay require the server-side Razorpay environment variables and a valid test setup. Do not export real environment values, session cookies, invite codes, or payment credentials with a collection.

The optional database seed is for local demos and tenant-isolation checks only. It is not required by signup. The seed reads `DEMO_PASSWORD`; its development fallback must never be used as a production credential.

## Implemented API groups

| Route group | Operations and access |
|---|---|
| `/api/auth` | Public signup, invite join, login, logout; session and account reads; signed-in account-name and password changes. |
| `/api/staff` | Manager-only staff list, create, edit, deactivate, and invite creation. Invites allow waiter or kitchen roles. |
| `/api/restaurant` | Authenticated restaurant summary; manager table management; manager/waiter table status; manager menu and GST billing configuration. |
| `/api/orders` | Authenticated order list/create; role-checked status transitions; waiter/manager manual payment recording; waiter/manager bill PDF. |
| `/api/service-requests` | Waiter/manager open request list and completion. |
| `/api/reports` | Manager sales and order reports. |
| `/api/qr/{restaurantSlug}` | Public restaurant menu, token-bound QR order creation, token-bound order status and bill, and table bill/water requests. |
| `/api/payments` | Razorpay order creation, signed checkout verification, and signed webhook processing. QR orders require their table token; non-QR orders require a manager/waiter session for the order's restaurant. |

KOT tickets and events are written during order creation and updated by order-status operations. There is no standalone KOT API. Menu items and tables are deactivated rather than physically deleted so order history can refer to them.

## Session and tenant scope

Login sets an HTTP-only `vistona_session` cookie. Protected handlers validate the signed cookie and re-check the user, active state, tenant, restaurant, and session version in PostgreSQL. Tenant and restaurant IDs supplied by a client are not used as authority for protected routes; those routes derive scope from the verified session. Public QR operations instead resolve a restaurant slug and validate the associated table token.

Use the route's normal response codes to distinguish validation and authorization errors (`400`, `401`, `403`, `404`, `409`, or `422`) from database/provider errors (commonly `503`). Some payment handlers allow unexpected provider or database exceptions to reach Next.js as `500` responses.

## Collection contents

The collection includes request folders for authentication, manager, waiter, kitchen, account, authorization, QR ordering, payments, tables, menu, KOT workflow, and tenant/security checks. KOT coverage uses the existing order status route; the folder does not represent a separate KOT API. The optional second-restaurant checks require a development seed or a second test account.

For current features, environment variable names, migration commands, and deployment notes, see the [project README](../README.md). Keep `.env.local` and all real credentials outside the collection and source control.
