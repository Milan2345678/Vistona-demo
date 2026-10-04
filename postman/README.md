# Vistona API audit and Postman guide

This audit reflects the handlers under `src/app/api` on the reviewed branch. It describes implemented behavior, not planned features. There are 12 route handlers and no middleware/proxy route guard.

## Setup

Use a local PostgreSQL database and configure `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters outside source control. For payment API calls, also configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` locally. Do not add these values to the collection.

From the repository root:

```sh
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

`db:migrate` runs `prisma migrate deploy` and applies the initial schema followed by the payment migration. `db:seed` runs `tsx prisma/seed.ts`. The app is then at `http://localhost:3000`. The collection's `baseUrl` defaults to this address.

The seed password is `DEMO_PASSWORD`, defaulting to `demo123`. The seed hashes it with bcrypt before writing it. Accounts created by the seed:

| Email                   | Password source                     | Role    | Tenant / restaurant                   |
| ----------------------- | ----------------------------------- | ------- | ------------------------------------- |
| `manager@vistona.local` | `DEMO_PASSWORD` (default `demo123`) | MANAGER | Anndham tenant / Anndham Family Dhaba |
| `waiter@vistona.local`  | `DEMO_PASSWORD` (default `demo123`) | WAITER  | Anndham tenant / Anndham Family Dhaba |
| `kitchen@vistona.local` | `DEMO_PASSWORD` (default `demo123`) | KITCHEN | Anndham tenant / Anndham Family Dhaba |
| `milan@vistona.local`   | `DEMO_PASSWORD` (default `demo123`) | MANAGER | Milan tenant / Milan Restaurant       |

The seed uses `gen_random_uuid()` database defaults; tenant, restaurant, and user IDs are generated when the seed runs and are not fixed values in source. Login returns the user's actual `id`, `tenantId`, and `restaurantId`. The Milan user/table/menu are development fixtures for isolation checks, not an onboarding flow. No live database query was performed as part of this audit, so these are seed-defined credentials and identities, not a claim that a particular database has been seeded.

## API reference

All JSON bodies below must be sent as raw JSON with `Content-Type: application/json`. Auth means a valid `vistona_session` cookie. `401` means no valid session; `403` means the session role is disallowed. Database/provider failures may also surface as `503` on handlers that catch them, or `500` on payment handlers that do not.

| Method and endpoint                                    | Purpose / access                                                                                                           | Body and parameters                                                                                                                               | Success                                                                                                               | Other implemented errors                                                                                                                |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/auth/login`                                 | Authenticate any active user; public                                                                                       | `{ "email": "manager@vistona.local", "password": "demo123" }`                                                                                     | `200` `{ user: { id, name, email, role, tenantId, restaurantId } }`; sets `vistona_session` cookie                    | `400` invalid JSON/email/password shape; `401` bad credentials; `503` missing DB/session config or DB failure                           |
| `GET /api/auth/session`                                | Read current session; public                                                                                               | None                                                                                                                                              | `200` `{ user: { id, email, role, tenantId, restaurantId } }`                                                         | `401` `{ user: null }` when unauthenticated                                                                                             |
| `POST /api/auth/logout`                                | Clear browser cookie; public                                                                                               | None                                                                                                                                              | `200` `{ ok: true }`; expires cookie                                                                                  | No auth/error requirement is implemented                                                                                                |
| `GET /api/restaurant`                                  | Read signed-in user's restaurant; any role                                                                                 | None                                                                                                                                              | `200` `{ restaurant, tables, menu }`; tables/menu populated for manager and waiter, empty arrays for kitchen          | `401`; `404` restaurant not found; `503` query failure                                                                                  |
| `GET /api/orders`                                      | List orders scoped to session tenant+restaurant; any role                                                                  | Optional query `since=<valid date/time>`; returns up to 100                                                                                       | `200` `{ orders: [...] }`                                                                                             | `401`; `400` invalid `since`; `503` query failure                                                                                       |
| `POST /api/orders`                                     | Create an authenticated waiter/POS order; MANAGER or WAITER (POS is manager-only)                                          | `{ "tableId": "<id or null>", "notes": "optional", "source": "WAITER                                                                              | POS", "items": [{ "menuItemId": "<id>", "quantity": 1 }] }`; `source`defaults to`WAITER`; 1-50 item entries           | `201` `{ order }`; server reads prices and derives tenant/restaurant/user from session; also creates initial KOT records                | `401`; `403` kitchen or waiter using POS; `400` invalid body; `422` table/item unavailable or invalid quantity; `503` creation failure |
| `PATCH /api/orders/{orderId}/status`                   | Change order lifecycle and update its KOT state/event; all authenticated roles, subject to per-transition role rules below | Path `orderId`; `{ "status": "PREPARING                                                                                                           | READY                                                                                                                 | SERVED                                                                                                                                  | COMPLETED                                                                                                                              | CANCELLED" }`                                                                                      | `200` `{ order }` | `401`; `400` invalid body/status; `403` role forbidden; `404` order outside current tenant/restaurant or absent; `409` invalid state transition; `503` update failure |
| `PATCH /api/restaurant/tables/{tableId}/status`        | Update a table; MANAGER or WAITER                                                                                          | Path `tableId`; `{ "status": "AVAILABLE                                                                                                           | OCCUPIED                                                                                                              | BILLING" }`                                                                                                                             | `200` `{ table }`                                                                                                                      | `401`; `403` kitchen; `400` invalid status; `404` outside-scope/absent table; `503` update failure |
| `PATCH /api/restaurant/menu/{menuItemId}/availability` | Toggle menu item availability; MANAGER only                                                                                | Path `menuItemId`; `{ "available": true }`                                                                                                        | `200` `{ item: { id, available } }`                                                                                   | `401`; `403` waiter/kitchen; `400` invalid body; `404` outside-scope/absent item; `503` update failure                                  |
| `GET /api/qr/{restaurantSlug}/menu`                    | Public menu for a restaurant; no auth                                                                                      | Path `restaurantSlug`                                                                                                                             | `200` `{ restaurant, menu }`; only available items                                                                    | `404` restaurant not found; `503` query failure                                                                                         |
| `POST /api/qr/{restaurantSlug}/orders`                 | Public QR order creation; no auth                                                                                          | Path `restaurantSlug`; `{ "tableNumber": "T01", "notes": "optional", "items": [{ "menuItemId": "<id>", "quantity": 1 }] }`; table number optional | `201` `{ order }`; source is `QR`, tenant/restaurant resolved from slug                                               | `400` invalid body; `404` restaurant/table not found; `422` invalid/unavailable item; `503` create failure                              |
| `POST /api/payments/create-order`                      | Create/reuse a Razorpay order; no auth check in handler                                                                    | `{ "orderId": "<database order id>" }`                                                                                                            | `200` `{ keyId, razorpayOrderId, amount, currency }`                                                                  | `400` invalid body; `404` order missing; `409` already paid; `422` amount below INR 1/invalid; provider/config/DB failures may be `500` |
| `POST /api/payments/verify`                            | Verify checkout signature and mark payment paid; no auth check in handler                                                  | `{ "razorpay_order_id": "...", "razorpay_payment_id": "...", "razorpay_signature": "..." }`                                                       | `200` `{ ok: true }`                                                                                                  | `400` invalid body/signature; `422` payment missing or amount mismatch; uncaught DB/provider errors may be `500`                        |
| `POST /api/payments/webhook`                           | Verify Razorpay webhook HMAC; no session auth                                                                              | Raw JSON webhook body and `x-razorpay-signature` header                                                                                           | `200` `{ ok: true }` for any validly signed event; `payment.captured` marks payment paid; `payment.failed` is ignored | `400` absent/invalid signature; malformed signed JSON/DB failures may be `500`                                                          |

The table above includes every route found under `src/app/api`. There are no user CRUD, signup, direct menu CRUD, table CRUD, standalone KOT, tenant CRUD, restaurant CRUD, or payment-read APIs.

## Roles and CRUD actually available

| Resource              | Create                                                | Read                                                                                 | Update                                           | Delete          |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------ | --------------- |
| Users                 | NOT IMPLEMENTED (seed only)                           | Current identity via session; no user listing                                        | NOT IMPLEMENTED                                  | NOT IMPLEMENTED |
| Tenant / restaurant   | NOT IMPLEMENTED                                       | `GET /api/restaurant` reads the session's restaurant                                 | NOT IMPLEMENTED                                  | NOT IMPLEMENTED |
| Tables                | NOT IMPLEMENTED by API (seed only)                    | Included in manager/waiter `GET /api/restaurant`                                     | Status only, manager/waiter                      | NOT IMPLEMENTED |
| Menu categories/items | NOT IMPLEMENTED by API (seed only)                    | Included in manager/waiter restaurant response; public QR menu reads available items | Availability only, manager                       | NOT IMPLEMENTED |
| Orders                | Authenticated waiter/manager and public QR            | `GET /api/orders` for any role, tenant+restaurant scoped                             | Status transitions only, role constrained        | NOT IMPLEMENTED |
| KOT tickets/events    | Created as part of order creation                     | NOT IMPLEMENTED by API                                                               | Updated as a side effect of order status changes | NOT IMPLEMENTED |
| Payments              | Razorpay order row created/reused by payment endpoint | NOT IMPLEMENTED                                                                      | Mark paid by checkout verification/webhook       | NOT IMPLEMENTED |

Role-specific behavior in code:

| Operation                                | MANAGER |  WAITER |                                                   KITCHEN |
| ---------------------------------------- | ------: | ------: | --------------------------------------------------------: |
| `GET /api/restaurant`, `GET /api/orders` | Allowed | Allowed | Allowed; restaurant response has empty tables/menu arrays |
| `POST /api/orders` source WAITER         | Allowed | Allowed |                                                       403 |
| `POST /api/orders` source POS            | Allowed |     403 |                                                       403 |
| Table status update                      | Allowed | Allowed |                                                       403 |
| Menu availability update                 | Allowed |     403 |                                                       403 |
| Order `NEW -> PREPARING -> READY`        | Allowed |     403 |                                                   Allowed |
| Order `READY -> SERVED`                  | Allowed | Allowed |                                                       403 |
| Order `SERVED -> COMPLETED`              | Allowed |     403 |                                                       403 |
| Cancel from NEW/PREPARING                | Allowed |     403 |                                                       403 |

The lifecycle is enforced as well as role checks: `NEW -> PREPARING -> READY -> SERVED -> COMPLETED`; cancellation is allowed from NEW/PREPARING only for a manager. An attempted status outside the current lifecycle can return `409` before a role-specific forbidden result. To test a role-based `403`, use an order in a state where the requested transition is otherwise valid.

## Session behavior

- Login does not return a bearer token. It returns the user identity and sets the signed `vistona_session` cookie with `HttpOnly`, `SameSite=Strict`, path `/`, and a 12-hour max age. `Secure` is enabled in production.
- Protected APIs read that cookie. Do not add `tenantId`, `restaurantId`, or role headers/body fields; the session is the source of identity.
- Postman stores and sends cookies in its cookie jar for the same host. Keep requests on `localhost` consistently; `127.0.0.1` is a different cookie host. No manual `Authorization` header is required.
- Logout expires the browser cookie. Sessions are stateless HMAC tokens; logout does not revoke a previously copied token, and there is no server-side session registry/revocation.
- Login as another role overwrites the cookie for the same host. For a clean beginner workflow, run Logout between logins. No separate browser or manual token switch is needed.

## Postman run order

Import `Vistona-API.postman_collection.json`. Set the password variables if `DEMO_PASSWORD` differs from its default. Run requests in this order:

1. `01 - Authentication / Login Manager`, then `02 - Manager / Get restaurant`; the latter stores Anndham `tableId`, `tableNumber`, `menuItemId`, and slug from the response.
2. Run manager menu/table/order requests. `06 - Orders / Create manager order` saves `orderId`; run lifecycle requests in sequence, with each status transition starting from the previous request's state.
3. Run `01 - Authentication / Logout`, then `Login Waiter`. In `03 - Waiter`, create an order (stores `waiterOrderId`), test allowed table operations, and run manager-only negative tests expecting `403`.
4. Run Logout, then `Login Kitchen`. In `04 - Kitchen`, fetch orders and run `PREPARING` then `READY` against `waiterOrderId`. Kitchen's attempt to change menu availability should return `403`.
5. Optionally login as Milan manager using `milan@vistona.local`. Run the Milan fixture requests in `10 - Negative/Security Tests` to capture a different tenant's IDs and create a Milan QR order. Then logout/login as Anndham manager and run the cross-tenant ID attempts; scoped table/menu/order operations should return `404`.
6. `05 - QR Ordering` tests the public QR menu and order flow. It creates real rows in the local development database.
7. Payment tests require valid local Razorpay configuration and an existing order. `Create payment order` contacts Razorpay. Verification/webhook examples intentionally use invalid signatures and assert rejection; test successful payment only through Razorpay's test checkout/webhook flow.
8. Run `10 - Negative/Security Tests / Unauthenticated restaurant request` only after Logout; it expects `401`.

The collection's `09 - KOT` folder is intentionally documentation-only because no KOT endpoint exists. The collection does not invent one.

## Tenant isolation and findings

Core authenticated restaurant/table/menu/order queries derive `tenantId` and `restaurantId` from the signed-in session, and updates include those scope values in SQL. QR requests resolve the restaurant by its public slug and scope menu/table/order operations to that restaurant. A client-supplied tenant or restaurant ID is not used as authority by those handlers.

Important payment security gap: `POST /api/payments/create-order` accepts any database `orderId` and has no session or tenant ownership check. The payment record also relates to `Order` by order ID only. The checkout signature and webhook HMAC protect marking a payment paid, but they do not authorize who may create/retrieve a provider order. Treat this endpoint as a backend security issue; Postman tests document the existing behavior rather than masking it.

There is no middleware/proxy protecting dashboard page routes in this repository; API handlers enforce their own session/role checks. The browser UI is not the security boundary.

The login handler returns `400` before querying the database when JSON parsing or the email/password schema fails; wrong credentials return `401`, and missing database/JWT configuration or query errors return `503`. In Postman use Body > raw > JSON, `Content-Type: application/json`, and exactly this shape:

```json
{
  "email": "manager@vistona.local",
  "password": "demo123"
}
```

If that exact valid body still gives `400`, check for extra quote characters, trailing commas inside values, or omitted `password`; if it gives `401`, the seeded password may differ from the current `DEMO_PASSWORD` or the seed may not have run.
