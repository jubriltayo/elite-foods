# Elite Foods and Snacks — Technical Requirements Document (MVP)

**Version:** 1.0  
**Date:** September 30, 2026  
**Companion document:** `Elite_Foods_and_Snacks_PRD_MVP.md`  
**Target deployment:** Vercel  
**MVP timeline:** 2 days

---

## 1. Purpose

This TRD translates the approved MVP PRD into an implementation plan.

The architecture is intentionally small:

- Next.js App Router + TypeScript
- Tailwind CSS
- Auth.js with the Google provider
- Google OAuth configured through Google Cloud Console
- Supabase PostgreSQL as the application database
- Mailgun for transactional confirmation email
- `localStorage` cart while signed out, `carts`/`cart_items` while signed in
- Vercel for deployment

### Critical architectural rule

**Supabase Auth must not be used.**

Google is the identity provider. Auth.js manages the OAuth flow and application session. Supabase is used for PostgreSQL data persistence only.

Do not replace Auth.js with:

- Supabase Auth
- Clerk
- Firebase Auth
- a custom OAuth implementation
- another hosted authentication platform

The Google OAuth application itself is created/configured in Google Cloud Console.

---

# 2. Architecture

```text
                         ┌──────────────────────┐
                         │     Google OAuth      │
                         │  Google Cloud Console │
                         └──────────┬───────────┘
                                    │
                                    │ OAuth
                                    ▼
┌──────────────┐          ┌─────────────────────────┐
│   Browser    │          │       Next.js App       │
│              │          │        on Vercel        │
│ React UI     │◄────────►│                         │
│ Tailwind     │          │ Auth.js + Google        │
│ localStorage │          │ Server Components       │
│ cart         │          │ Server Actions/Routes   │
└──────────────┘          │ Validation + ordering   │
                          └──────────┬──────────────┘
                                     │
                    ┌────────────────┼─────────────────┐
                    │                │                 │
                    ▼                ▼                 ▼
             ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
             │   Supabase  │  │   Mailgun   │  │   Auth.js   │
             │ PostgreSQL  │  │    Email    │  │   Session   │
             └─────────────┘  └─────────────┘  └─────────────┘
```

### Request boundary

The browser must not send sensitive operations directly to Supabase or Mailgun.

Use Next.js server-side code for:

- authenticated user lookup
- order creation
- price calculation
- delivery-fee calculation
- order retrieval
- admin operations
- Mailgun email sending
- protected database access

The cart is the only persistent client-side state. It is stored in `localStorage`
while signed out and in `carts`/`cart_items` while signed in, so the same cart is
seen on every device the customer uses, including the mobile app.

---

# 3. Technology Stack

| Concern           | Technology                            |
| ----------------- | ------------------------------------- |
| Framework         | Next.js App Router                    |
| Language          | TypeScript, strict mode               |
| Styling           | Tailwind CSS                          |
| Authentication    | Auth.js + Google provider             |
| Identity provider | Google OAuth via Google Cloud Console |
| Database          | Supabase PostgreSQL                   |
| Database client   | `@supabase/supabase-js`               |
| Validation        | Zod                                   |
| Email             | Mailgun REST API                      |
| Cart              | `localStorage`, or Supabase tables    |
| Hosting           | Vercel                                |

### Packages

Minimum application dependencies:

```text
next
react
react-dom
next-auth
@supabase/supabase-js
zod
```

Use the current stable versions compatible with the selected Next.js version.

Do not add large state-management libraries, payment SDKs, Supabase Auth packages, or unnecessary backend frameworks.

---

# 4. Authentication Architecture

## 4.1 Responsibility of each system

| System               | Responsibility                                     |
| -------------------- | -------------------------------------------------- |
| Google Cloud Console | OAuth application, client ID and client secret     |
| Google               | Identity provider                                  |
| Auth.js              | Google OAuth integration and application session   |
| Next.js              | Auth callbacks, route protection and authorization |
| Supabase             | Application database                               |
| Mailgun              | Transactional email                                |

## 4.2 Google identity

Google's stable user identifier (`sub`) is the identity key.

Store it in:

```text
profiles.google_sub
```

Do not use the user's email address as the primary identity key.

Email may change; Google's `sub` is intended to identify the Google account.

## 4.3 Auth.js configuration

Configure the Google provider with:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
AUTH_SECRET
```

Use Auth.js JWT sessions for the MVP unless the installed Auth.js version requires another supported configuration.

The Auth.js session identifies the application user. The authoritative role remains in Supabase.

### User creation/update

After successful Google authentication:

1. Read the Google provider account identifier.
2. Treat that value as `google_sub`.
3. Find the matching `profiles` record.
4. Create it if it does not exist.
5. Update basic Google profile information if it already exists.
6. Never overwrite `role` from Google.
7. Establish the Auth.js session.
8. Continue to the requested application page.

A newly created profile receives:

```text
role = customer
```

The admin role is assigned manually in the database.

## 4.4 Session rules

The application must not trust a role supplied by the browser.

For protected operations:

1. Read the Auth.js session.
2. Resolve the application's `profiles.id`.
3. Load the current profile from Supabase.
4. Check `role`.
5. Perform the requested operation only if authorized.

This means changing a user's role in Supabase takes effect without relying on stale client state.

## 4.5 Google Cloud Console

Create a Google Cloud project and configure:

1. OAuth consent screen.
2. Application name and support email.
3. Google OAuth Client ID.
4. Client type: Web application.
5. Local authorized redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

6. Production authorized redirect URI using the deployed Vercel domain:

```text
https://YOUR_DOMAIN/api/auth/callback/google
```

Use the callback path generated by the chosen Auth.js setup.

The exact production URI must match the deployed application's Auth.js callback URL.

Do not use a Supabase OAuth callback URL.

---

# 5. Authorization

There are two application roles:

```text
customer
admin
```

## Customer permissions

Customers can:

- browse products
- filter products
- manage their cart, which follows them across devices once signed in
- create orders
- view their own orders
- view their own profile information

Customers cannot:

- view another customer's order
- access `/admin`
- change their own role
- modify product records
- update order status

## Admin permissions

Admins can:

- view all orders
- view order details
- update order status
- mark products available/unavailable

Every admin operation must be authorized on the server.

A hidden button or client-side route guard is not sufficient.

---

# 6. Database Design

Supabase PostgreSQL is the persistent store.

The application uses seven tables:

1. `profiles`
2. `products`
3. `product_variants`
4. `orders`
5. `order_items`
6. `carts`
7. `cart_items`

## 6.1 `profiles`

```sql
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  full_name text,
  phone text,
  role text not null default 'customer'
    check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`google_sub` must be unique.

## 6.2 `products`

```sql
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text not null
    check (category in ('fried-snacks', 'nuts-and-grains', 'drinks')),
  image_url text,
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);
```

## 6.3 `product_variants`

```sql
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  price integer not null check (price > 0)
);

create index product_variants_product_id_idx
on public.product_variants(product_id);
```

A product must have at least one valid variant.

Prices are whole Nigerian Naira values:

```text
300  = ₦300
1000 = ₦1,000
```

Do not use floating-point values for money.

## 6.4 `orders`

```sql
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key uuid unique,
  user_id uuid not null references public.profiles(id),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'confirmed',
        'out_for_delivery',
        'delivered',
        'cancelled'
      )
    ),
  payment_method text not null default 'pay_on_delivery'
    check (payment_method = 'pay_on_delivery'),
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid')),
  delivery_area text not null,
  delivery_address text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  note text,
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  total integer not null check (total >= 0),
  created_at timestamptz not null default now()
);

create index orders_user_created_idx
on public.orders(user_id, created_at desc);

create index orders_created_idx
on public.orders(created_at desc);
```

## 6.5 `order_items`

```sql
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_label text not null,
  unit_price integer not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 100)
);

create index order_items_order_id_idx
on public.order_items(order_id);
```

Product name, variant label and price are copied into `order_items` as historical snapshots.

If a product is later renamed or its price changes, an old order must still show the original information.

## 6.6 `carts`

```sql
create table public.carts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

One cart per customer, enforced by the unique constraint on `user_id`.

The cart stores no prices, product names or availability. Those are resolved from
`products` and `product_variants` on every read, so a cart can never carry a stale
price.

## 6.7 `cart_items`

```sql
create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null check (quantity between 1 and 100),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

create index cart_items_cart_id_idx
on public.cart_items(cart_id);
```

A line stores only a variant reference and a quantity. That is the whole contract.

`variant_id` is nullable and uses `ON DELETE SET NULL`, deliberately matching
`order_items`. When an admin deletes a variant, the line is kept as a dead line
rather than silently disappearing, so the customer can be shown why their cart
changed. See section 13.

Postgres treats `NULL` values as distinct in a unique constraint, so one cart may
hold more than one dead line. That is intended and no additional constraint is added
to prevent it.

Cart lines are read and written only through server code that filters by the
resolved profile, so ownership is enforced server-side. RLS is enabled and no
client policy is created, matching every other application table.

---

# 7. Database Relationships

```text
profiles
   │
   │ 1
   │
   └──────────< orders
                  │
                  │ 1
                  │
                  └──────────< order_items
                                │
                                │ >──── 1
                                │
                         product_variants
                                │
                                │ >──── 1
                                │
                             products
```

Relationships:

- One profile has many orders.
- One order has many order items.
- One product has many variants.
- One variant belongs to one product.
- One order item references one variant.

---

# 8. Supabase Security

## 8.1 RLS

Enable Row Level Security on every application table:

```sql
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
```

Because authentication is handled by Auth.js, do not use:

```text
auth.uid()
```

as the application identity mechanism.

The application identity comes from the Auth.js session and the matching `profiles` record.

## 8.2 Database access

Use a server-only Supabase client for protected operations.

Recommended:

```text
lib/db.ts
```

The service-role key must:

- exist only on the server
- never use a `NEXT_PUBLIC_` prefix
- never be sent to the browser
- never be committed to Git

All customer ownership checks happen in trusted Next.js server code.

For example:

```text
SELECT order
WHERE id = requestedOrderId
AND user_id = currentProfileId
```

Never retrieve an order only by its ID and then rely on the client to decide whether it belongs to the customer.

## 8.3 Public catalog data

Product catalog data can be read server-side.

The browser does not need a direct database connection.

This keeps the architecture simple and prevents the client from gaining unnecessary database access.

---

# 9. Order Creation

Order creation is a server-only operation.

The browser may submit:

```text
variant IDs
quantities
customer name
phone
delivery area
delivery address
optional note
```

The browser must never be trusted for:

```text
product names
prices
subtotal
delivery fee
total
user ID
order status
payment status
```

## Server-side algorithm

1. Require a valid Auth.js session.
2. Resolve the current `profiles` row.
3. Validate the checkout payload with Zod.
4. Validate every variant ID.
5. Load the authoritative variants and parent products from Supabase.
6. Confirm every product is currently available.
7. Confirm requested quantities are valid.
8. Calculate each line total.
9. Calculate subtotal.
10. Calculate delivery fee using the configured business rule.
11. Calculate total.
12. Generate a unique order number.
13. Insert the order and order items atomically.
14. Send the Mailgun confirmation email.
15. Return the created order number.
16. Clear the browser cart.
17. Redirect to confirmation.

### Pricing

```text
subtotal = Σ(unit_price × quantity)

total = subtotal + delivery_fee
```

Never use a price supplied by the browser as authoritative.

---

# 10. Atomic Order Creation

Use a PostgreSQL transaction/RPC so an order cannot be created without its items.

Recommended database function:

```text
create_order(...)
```

The function should receive already-validated server-side values.

The transaction should:

1. create the order
2. create all order items
3. commit both together

If either step fails, the entire operation must roll back.

---

# 11. Duplicate Order Protection

The checkout UI must disable the Place Order button while the request is being processed.

Also generate an idempotency key for a checkout submission.

Recommended database field:

```text
orders.idempotency_key
```

with a unique constraint.

If the same request is retried, return the existing order instead of creating a second order.

The idempotency mechanism is secondary to the basic order flow, but should be implemented if time permits.

---

# 12. Order Numbers

Generate a human-readable order number such as:

```text
EFS-000123
```

Use a database sequence or another server-side mechanism that guarantees uniqueness.

Never generate order numbers from client input.

New orders start with:

```text
status = pending
payment_status = unpaid
payment_method = pay_on_delivery
```

Allowed statuses:

```text
pending
confirmed
out_for_delivery
delivered
cancelled
```

Keep this status list in one application validation module and mirror it in the database constraint.

---

# 13. Cart

Adding to a cart and browsing never require authentication. Where the cart is
stored depends on whether the customer is signed in.

| Customer state | Storage                                        |
| -------------- | ---------------------------------------------- |
| Signed out     | `localStorage` on that device                  |
| Signed in      | `carts` / `cart_items`, keyed to `profiles.id` |

The server-side cart exists so the same cart is visible on every device the
customer uses, including the mobile app.

Shape, identical in both cases:

```ts
type CartItem = {
  variantId: string;
  quantity: number;
};
```

A server-side cart persists only `variantId` and `quantity`. No price, product name
or availability is stored with it. Every read resolves current product and variant
rows from Supabase and computes the subtotal with the pricing functions, so a cart
can never carry a stale price.

## Cart requirements

- Add item.
- Increase quantity.
- Decrease quantity.
- Remove item.
- Show subtotal.
- Persist across refresh.
- Continue shopping.
- Proceed to checkout.

## Merge on sign-in

When a signed-out customer signs in, their `localStorage` cart is merged into the
server cart.

- Quantities are **summed** per `variantId`.
- Each merged quantity is capped at `MAX_QUANTITY`.
- Server lines the device cart does not mention are left untouched.

The merge must be applied **at most once**. The client snapshots its local cart,
clears it _before_ awaiting the merge, and restores the snapshot only if the merge
request fails. Clearing first makes a repeated sign-in structurally unable to apply
the merge twice, and the restore path means a network failure never loses a basket.

## Unavailable variants

`cart_items.variant_id` is nullable with `ON DELETE SET NULL`, matching
`order_items`. When an admin deletes a variant that a customer still has in their
cart, the line is retained as a **dead line** rather than silently removed, so the
customer can be told what happened.

Dead-line behaviour:

- Reported as an issue on cart read, carrying the line's own id so the client can
  offer to remove it.
- Excluded from the item count and the subtotal.
- Removed when the cart is replaced with the customer's current list.
- Never used to create an order item. Checkout rejects a cart that still contains
  one.

## Corrupt client cart

If `localStorage` contains invalid JSON or invalid cart entries:

1. Ignore the invalid state.
2. Clear the corrupt cart.
3. Start with an empty cart.
4. Do not crash the application.

---

# 14. Checkout

Route:

```text
/checkout
```

Access:

```text
Authenticated customer
```

If unauthenticated:

```text
/checkout
    ↓
/login
    ↓
Google authentication
    ↓
/checkout
```

The cart must survive this authentication redirect.

## Fields

Required:

- Customer name
- Phone number
- Delivery area
- Delivery address

Optional:

- Order note

Fixed payment method:

```text
Pay on Delivery
```

No Paystack, Stripe or other online payment provider is included in the MVP.

## Phone validation

Accept common Nigerian formats such as:

```text
08012345678
+2348012345678
```

Normalize/validate server-side.

---

# 15. Delivery Pricing

The MVP uses a simple configurable delivery rule.

Initial PRD default:

```text
Abeokuta → flat configured delivery fee
```

The actual fee must be confirmed before production use.

Keep delivery logic in a single configuration module rather than scattering prices through components.

Example:

```text
src/lib/config/business.ts
```

Additional delivery areas can be added later without changing the core order model.

---

# 16. Mailgun Integration

Send confirmation email only from server-side code.

Use the Mailgun REST API with `fetch`.

Required environment variables:

```text
MAILGUN_API_KEY
MAILGUN_DOMAIN
MAILGUN_FROM_EMAIL
```

## Email contents

The confirmation email must include:

- Elite Foods and Snacks
- Order number
- Customer name
- Ordered products
- Variant/size
- Quantity
- Unit price
- Subtotal
- Delivery fee
- Total
- Delivery address
- Payment method
- Shop contact information

A simple responsive HTML email is sufficient.

## Failure handling

Mailgun failure must not invalidate the order.

Correct sequence:

```text
Create order successfully
        ↓
Attempt Mailgun email
        ↓
Email succeeds ──► continue
        │
        └──────────► log failure
                     keep order
                     show confirmation
```

Do not create a second order because email sending failed.

---

# 17. Pages and Routes

| Route                       | Purpose         | Access                 |
| --------------------------- | --------------- | ---------------------- |
| `/`                         | Home            | Public                 |
| `/shop`                     | Product catalog | Public                 |
| `/shop/[slug]`              | Product detail  | Public                 |
| `/cart`                     | Cart            | Public                 |
| `/login`                    | Google sign-in  | Public                 |
| `/checkout`                 | Checkout        | Authenticated customer |
| `/orders`                   | Customer orders | Authenticated customer |
| `/orders/[id]`              | Order detail    | Owner/admin            |
| `/orders/[id]/confirmation` | Confirmation    | Owner/admin            |
| `/admin`                    | Admin dashboard | Admin                  |

Auth.js callback routes are handled by the Auth.js configuration.

---

# 18. Suggested Project Structure

```text
/
├── app/
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts
│   ├── checkout/
│   │   ├── page.tsx
│   │   └── actions.ts
│   ├── login/
│   │   └── page.tsx
│   ├── orders/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── confirmation/
│   │           └── page.tsx
│   ├── shop/
│   │   ├── page.tsx
│   │   └── [slug]/
│   │       └── page.tsx
│   ├── admin/
│   │   ├── page.tsx
│   │   ├── actions.ts
│   │   └── layout.tsx
│   ├── cart/
│   │   └── page.tsx
│   ├── page.tsx
│   └── layout.tsx
│
├── components/
│   ├── header.tsx
│   ├── product-card.tsx
│   ├── product-grid.tsx
│   ├── variant-selector.tsx
│   ├── quantity-selector.tsx
│   ├── cart-drawer.tsx
│   └── checkout-form.tsx
│
├── context/
│   └── cart-context.tsx
│
├── lib/
│   ├── auth.ts
│   ├── db.ts
│   ├── validation.ts
│   ├── pricing.ts
│   ├── email.ts
│   ├── format.ts
│   ├── business.ts
│   ├── orders.ts
│   └── products.ts
│
├── supabase/
│   ├── migrations/
│   │   └── 0001_init.sql
│   └── seed.sql
│
├── public/
│   └── products/
│
├── auth.ts
├── next.config.ts
├── package.json
└── README.md
```

The exact Auth.js route/configuration structure may vary with the installed Auth.js version. Keep authentication logic out of UI components.

---

# 19. Server/Client Boundary

## Client components

Use client components only where browser interaction is required:

- cart state
- quantity controls
- variant selection
- checkout form interactions
- category filter UI

## Server components/actions

Use server-side code for:

- product data retrieval where appropriate
- authenticated user retrieval
- checkout validation
- price calculation
- order creation
- order retrieval
- admin authorization
- admin mutations
- Mailgun

Do not import server-only secrets into client components.

---

# 20. Validation

Use Zod schemas shared between form-level validation and server-side validation where practical.

Minimum validation:

### Product/variant

- valid UUID
- valid product/variant relationship
- product is available
- variant exists

### Quantity

```text
integer
>= 1
<= 100
```

### Customer

```text
name: non-empty
phone: valid Nigerian format
```

### Delivery

```text
delivery area: allowed value
delivery address: non-empty
```

### Order

- cart is not empty
- all variants exist
- all products are available
- prices come from database
- total is recalculated on server

---

# 21. Admin Dashboard

Route:

```text
/admin
```

Server-side admin check is mandatory.

## Orders

Display:

- order number
- customer
- total
- status
- date

Allow admin to open an order and update:

```text
pending
confirmed
out_for_delivery
delivered
cancelled
```

## Product availability

Allow admin to toggle:

```text
available
unavailable
```

When unavailable:

- product remains visible
- product is marked unavailable
- Add to Cart is disabled
- checkout rejects it if it was already in a cart

The MVP does not track inventory quantities.

---

# 22. Customer Orders

`/orders` must query only the current customer's orders.

`/orders/[id]` must verify ownership before returning the order.

The order detail page shows:

- order number
- products
- variants
- quantities
- unit prices
- subtotal
- delivery fee
- total
- delivery information
- payment method
- status

A customer opening another customer's order should receive a not-found/unauthorized response rather than the other customer's data.

---

# 23. Seed Data

Seed approximately 8–10 products.

Initial categories:

### Fried Snacks

- Dodo Ikire
- Akara Chips
- Chin Chin

### Nuts and Grains

- Kuli Kuli
- Groundnuts

### Drinks

- Zobo Drink
- Tigernut Drink

Add 1–3 additional sensible products if needed.

Each product should have realistic variants.

Do not invent unrealistic sizes simply to reach a product count.

Exact:

- prices
- descriptions
- images
- contact details
- delivery fees

remain configurable/placeholder data until confirmed.

---

# 24. Environment Variables

Expected configuration:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

SUPABASE_SERVICE_ROLE_KEY=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AUTH_SECRET=

MAILGUN_API_KEY=
MAILGUN_DOMAIN=
MAILGUN_FROM_EMAIL=

NEXT_PUBLIC_SITE_URL=
```

### Secret handling

Never commit:

```text
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_CLIENT_SECRET
AUTH_SECRET
MAILGUN_API_KEY
```

Only values genuinely needed by browser code may use `NEXT_PUBLIC_`.

The Supabase service-role key must never be public.

---

# 25. Vercel Deployment

## Local

Run the application locally and configure:

```text
http://localhost:3000
```

Configure the local Google OAuth callback in Google Cloud Console.

## Production

1. Push the project to GitHub.
2. Import the repository into Vercel.
3. Configure production environment variables.
4. Deploy.
5. Copy the stable production domain.
6. Add the production Google OAuth callback URI to Google Cloud Console.
7. Test Google login.
8. Test the complete purchase flow.
9. Verify the order in Supabase.
10. Verify the Mailgun email.
11. Test the admin flow.

Do not rely on changing Vercel preview URLs for the primary Google OAuth configuration.

---

# 26. Responsive Requirements

The UI is mobile-first.

Minimum target width:

```text
360px
```

Also support desktop widths.

Prioritize usability of:

- product browsing
- product detail
- cart
- login
- checkout
- order confirmation

Optimize product images because users may access the shop over mobile data.

---

# 27. Security Requirements

The implementation must satisfy all of the following:

- No Supabase Auth.
- Google OAuth configured through Google Cloud Console.
- Auth.js manages the application session.
- Google client secret is server-only.
- Supabase service-role key is server-only.
- Mailgun API key is server-only.
- Supabase RLS is enabled.
- Customer ownership checks happen server-side.
- Admin authorization happens server-side.
- Browser prices are never trusted.
- Browser totals are never trusted.
- Browser user IDs are never trusted.
- Order status cannot be changed by customers.
- Role cannot be changed through customer-facing UI.
- Orders are created server-side.
- Order/item creation is atomic.
- Historical order item data is snapshotted.
- Mailgun failure cannot delete/rollback a successful order.

---

# 28. Edge Cases

| Situation                       | Required behavior                                |
| ------------------------------- | ------------------------------------------------ |
| Empty cart at checkout          | Redirect to cart                                 |
| Not authenticated               | Redirect to Google login                         |
| Google login cancelled          | Return to login with clear error                 |
| Google login fails              | Return to login with clear error                 |
| Cart survives refresh           | Restore valid localStorage state                 |
| Corrupt cart                    | Clear invalid state                              |
| Product becomes unavailable     | Reject checkout and identify product             |
| Browser changes price           | Ignore browser price                             |
| Invalid quantity                | Reject                                           |
| Quantity <= 0                   | Reject                                           |
| Invalid variant                 | Reject                                           |
| Invalid phone                   | Show validation error                            |
| Double-click Place Order        | Prevent duplicate submission                     |
| Duplicate checkout retry        | Reuse existing order when idempotency is enabled |
| Database transaction fails      | No partial order                                 |
| Mailgun fails                   | Keep order and log failure                       |
| Customer opens another order    | Reject/not found                                 |
| Customer opens admin            | Deny access                                      |
| Non-admin calls admin mutation  | Reject server-side                               |
| Product has no image            | Placeholder image                                |
| Session expires during checkout | Require authentication again                     |
| Product changes after purchase  | Preserve historical snapshot                     |

---

# 29. Testing Strategy

The MVP should prioritize end-to-end correctness.

## Authentication tests

- Google login succeeds.
- Google login cancellation is handled.
- New Google user creates a profile.
- Existing Google user is reused.
- `google_sub` is unique.
- Customer cannot change role.
- Admin role is recognized server-side.
- Logout ends the session.

## Shopping tests

- Products load.
- Category filter works.
- Product detail works.
- Variant selection works.
- Quantity works.
- Add to cart works.
- Cart survives refresh.
- Remove/update quantity works.
- Unavailable products cannot be added.

## Checkout tests

- Empty cart cannot place an order.
- Authentication redirect works.
- Checkout data validates.
- Manipulated prices are ignored.
- Unavailable products are rejected.
- Server calculates subtotal.
- Server calculates delivery fee.
- Server calculates total.
- Order and items are created atomically.
- Duplicate submission does not create duplicate orders.

## Order tests

- Customer sees own orders.
- Customer cannot see another customer's order.
- Admin sees all orders.
- Admin can update status.
- Admin can update product availability.

## Email tests

- Confirmation email is sent.
- Email contains correct order information.
- Mailgun failure does not delete order.

## Deployment tests

- Production Google login works.
- Production checkout works.
- Supabase contains the order.
- Mailgun sends confirmation.
- Admin flow works.
- UI works at 360px.

---

# 30. Build Order

## Day 1 — Foundation and shopping

1. Create Next.js project.
2. Configure TypeScript.
3. Configure Tailwind.
4. Create Supabase project.
5. Create database schema.
6. Enable RLS.
7. Seed products.
8. Configure Auth.js.
9. Create Google OAuth credentials in Google Cloud Console.
10. Implement Google authentication.
11. Build home page.
12. Build shop page.
13. Build product detail page.
14. Build cart.
15. Implement `localStorage` persistence.

## Day 2 — Checkout, orders, email and admin

1. Protect checkout.
2. Implement checkout validation.
3. Implement server-side pricing.
4. Implement transactional order creation.
5. Implement order confirmation page.
6. Implement My Orders.
7. Configure Mailgun.
8. Implement confirmation email.
9. Build admin dashboard.
10. Implement order status updates.
11. Implement product availability.
12. Deploy to Vercel.
13. Configure production environment variables.
14. Configure production Google OAuth callback.
15. Run end-to-end production test.
16. Write README.

Test the complete purchase flow before spending significant time on visual polish.

---

# 31. Acceptance Checklist

## Shopping

- [ ] Browse products.
- [ ] Filter by category.
- [ ] View product details.
- [ ] Select variant.
- [ ] Select quantity.
- [ ] Add to cart.
- [ ] Change quantity.
- [ ] Remove item.
- [ ] Cart survives refresh.
- [ ] Unavailable products cannot be ordered.

## Authentication

- [ ] Google sign-in works.
- [ ] Google OAuth is configured through Google Cloud Console.
- [ ] Auth.js manages the session.
- [ ] Supabase Auth is not used.
- [ ] Profile is created/updated after sign-in.
- [ ] Customer cannot modify role.
- [ ] Authentication works in production.

## Checkout

- [ ] Unauthenticated user is redirected to login.
- [ ] Cart survives authentication.
- [ ] Delivery information is captured.
- [ ] Pay on Delivery is available.
- [ ] Server calculates totals.
- [ ] Browser prices are ignored.
- [ ] Invalid orders are rejected.
- [ ] Order and items are atomic.

## Orders

- [ ] Unique order number is created.
- [ ] Customer can view own orders.
- [ ] Customer cannot view another customer's orders.
- [ ] Order status is visible.
- [ ] Admin sees all orders.
- [ ] Admin can update order status.
- [ ] Admin can manage availability.

## Email

- [ ] Mailgun confirmation email is sent.
- [ ] Email contains correct order data.
- [ ] Mailgun credentials are server-only.
- [ ] Email failure does not destroy an order.

## Security

- [ ] RLS enabled.
- [ ] Service-role key server-only.
- [ ] Google client secret server-only.
- [ ] Mailgun key server-only.
- [ ] Admin checks are server-side.
- [ ] Order ownership checks are server-side.

## Deployment

- [ ] Deployed to Vercel.
- [ ] Production OAuth callback configured.
- [ ] Production environment variables configured.
- [ ] Production purchase flow tested.
- [ ] README completed.
- [ ] 360px layout tested.

---

# 32. Definition of Done

The internship MVP is complete when a reviewer can:

1. Open the deployed website.
2. Browse the product catalog.
3. Select a product and variant.
4. Add it to the cart.
5. Sign in using Google.
6. Complete checkout.
7. Place an order.
8. Verify the order in Supabase.
9. Receive the Mailgun confirmation email.
10. View the order in My Orders.
11. Sign in as the admin.
12. View the order in the admin dashboard.
13. Change its status.
14. Mark a product unavailable.
15. Confirm that the unavailable product cannot be ordered.

The implementation should remain small, understandable, secure, and focused on demonstrating the required technologies.

---

# 33. Explicitly Avoid These Mistakes

This section is important for AI-assisted implementation.

### Do NOT do this

```text
Supabase Auth
Supabase Google provider
auth.users
auth.uid()
@supabase/ssr
Clerk
Firebase Auth
custom hand-written OAuth
Paystack
Stripe
guest checkout
email/password authentication
```

### Do this instead

```text
Google Cloud Console
        ↓
Google OAuth
        ↓
Auth.js Google provider
        ↓
Auth.js session
        ↓
profiles.google_sub
        ↓
Next.js server authorization
        ↓
Supabase PostgreSQL
```

The core architectural distinction is:

> **Google handles identity, Auth.js handles application authentication/session management, Supabase stores application data.**

---

# 34. Final Implementation Principle

This is a 2-day internship MVP, not a production-scale ecommerce platform.

Prefer:

- fewer dependencies
- clear server/client boundaries
- simple database queries
- server-side validation
- small reusable components
- straightforward Auth.js configuration
- simple Mailgun integration
- simple `localStorage` cart
- clear error states

Avoid:

- premature abstractions
- microservices
- complex state management
- online payments
- inventory systems
- delivery tracking
- advanced analytics
- unnecessary infrastructure

The successful implementation is the smallest system that reliably demonstrates:

```text
Browse
  ↓
Select variant
  ↓
Cart
  ↓
Google authentication
  ↓
Checkout
  ↓
Server validates + recalculates
  ↓
Supabase stores order
  ↓
Mailgun sends confirmation
  ↓
Customer views order
  ↓
Admin manages order
```

---

# 35. Mobile API

A separate mobile app (React Native with Expo) is built in its own repository. It
talks to this application over a versioned JSON API rather than over the pages.

The full request and response contract is maintained in
[`docs/MOBILE_API_PLAN.md`](./MOBILE_API_PLAN.md). This section records the
architecture rules the implementation must satisfy.

## 35.1 Routes

Route handlers live under `src/app/api/v1`. They sit alongside, and do not replace,
`/api/auth/[...nextauth]`, which Auth.js continues to own.

| Method | Path                      | Auth  | Purpose                           |
| ------ | ------------------------- | ----- | --------------------------------- |
| `POST` | `/api/v1/auth/token`      | none¹ | Exchange a Google ID token        |
| `GET`  | `/api/v1/delivery-areas`  | none  | Delivery areas and fees           |
| `GET`  | `/api/v1/payment-methods` | none  | Valid payment methods             |
| `GET`  | `/api/v1/categories`      | none  | Valid product categories          |
| `GET`  | `/api/v1/products`        | none  | Catalog                           |
| `GET`  | `/api/v1/products/[slug]` | none  | One product with variants         |
| `GET`  | `/api/v1/cart`            | req.  | Read the cart, priced server-side |
| `PUT`  | `/api/v1/cart`            | req.  | Replace the cart                  |
| `POST` | `/api/v1/cart/merge`      | req.  | Additive merge                    |
| `POST` | `/api/v1/orders`          | req.  | Place an order from the cart      |
| `GET`  | `/api/v1/orders`          | req.  | The caller's order history        |
| `GET`  | `/api/v1/orders/[id]`     | req.  | One order, ownership-checked      |

¹ A Google ID token in the body is the credential being exchanged.

## 35.2 Thin routes

A route handler is a transport. It authenticates, validates input with Zod, and
delegates.

- All business logic stays in `src/lib`: pricing, validation, availability, order
  creation and ownership checks.
- Server Actions and API routes call the same `src/lib` functions. Checkout rules are
  never implemented twice.
- `createOrderForProfile` is not refactored to suit a new caller. A new caller adapts
  to it.

The second bullet is enforced structurally. Order placement lives in
`lib/checkout.ts` as `placeOrderForProfile`, and both the checkout Server Action and
`POST /api/v1/orders` call it. Its parameter type is `Omit<CheckoutInput, "items">`,
so a transport **cannot** pass a basket at all — the rule that the saved cart is the
only source of truth is a compile error rather than a convention.

The server decides the user, the prices, availability and the totals. A route never
accepts a price, a subtotal, a total, a role or a user id from a client.

## 35.3 Authentication

Routes accept either credential through one shared helper, so no route implements
authentication itself:

- The existing web session cookie (Auth.js).
- An `Authorization: Bearer` API token.

A route handler must never call `redirect()`. Guarding with a redirect, as the
protected pages do, would answer an API client with a 307 and an HTML login page
instead of a JSON error. A route returns the JSON envelope from section 35.6 with
status `401` and code `UNAUTHENTICATED`.

Identity is resolved to `profiles.google_sub` on both paths. `role` is never carried
in a token and is re-read from the database on every request that needs it.

API tokens are signed with a dedicated `API_TOKEN_SECRET`, which is separate from
`AUTH_SECRET` so that compromising one does not compromise the other. Tokens carry
`iss` and `aud` claims and both are verified on use, so a token minted for one
purpose cannot be presented for another.

The service-role key is never exposed to any client, in any transport.

## 35.4 Public data

Catalog reads are public. RLS stays enabled on all seven tables with no client
policies, so the anon key returns nothing. Public catalog data is served by the
application, not by handing out a database credential.

Three read-only reference endpoints are also public: `/api/v1/delivery-areas`,
`/api/v1/payment-methods` and `/api/v1/categories`. Each exists because the
corresponding request field is validated strictly, so a client must be able to
discover the valid values rather than hardcode them. They read the constants in
`src/lib/config/business.ts` — the same ones the web pages render — and touch no
database, so they cannot disagree with the site or with each other.

## 35.5 Server-side cart

A signed-in cart lives in `carts`/`cart_items` and is read through `src/lib/cart.ts`.
See sections 6.6, 6.7 and 13.

A cart read resolves current product and variant rows and computes the subtotal with
the pricing functions. Totals are never stored and never accepted from a client.

## 35.6 Response envelope

Every response uses one shape.

Success:

```json
{ "data": {}, "error": null }
```

Failure:

```json
{
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Safe to show a user",
    "fields": {}
  }
}
```

Codes: `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404),
`VALIDATION_ERROR` (400), `CONFLICT` (409), `RATE_LIMITED` (429), `INTERNAL` (500). The
code and its status come from one table in `src/lib/api-response.ts`, so they cannot
drift apart.

`FORBIDDEN`, `CONFLICT` and `RATE_LIMITED` are declared but **not currently returned by
any route**: there is no admin API to forbid and no application-level rate limiter. They
are declared so that adding either feature does not also mean inventing an error
convention. In particular, **a repeated idempotency key with a different body is not a
`409`** — it is a `200` that returns the original order, because the key rather than the
body is the retry boundary. See `docs/MOBILE_API_PLAN.md`.

An unexpected exception must still produce this envelope. Handlers are wrapped so a
bug returns `INTERNAL` rather than an HTML error page or a stack trace. Internal
detail goes to the server log only.

Another customer's order returns `NOT_FOUND`, not `FORBIDDEN`, so the response does
not confirm that the row exists.

## 35.7 Known gap

There is no application-level rate limiter. The token exchange endpoint relies on
Vercel's platform limits. It must reject an invalid Google ID token before performing
any database access, so a forged token costs a signature check and nothing more.
