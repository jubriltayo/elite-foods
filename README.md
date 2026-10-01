# Elite Foods and Snacks

Mobile-first ecommerce MVP for a Nigerian snacks and drinks shop. Browse →
Cart → Google Login → Checkout → Pay on Delivery → Confirmation email.

Status: **customer purchase journey complete.** Catalog, cart, Google
authentication, checkout, atomic order creation, Mailgun confirmation email and
order history are built and verified against the live Supabase project.

**Not built yet:** the admin dashboard (order status updates, product
availability). See `AGENTS.md` §14 for the phase plan.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind CSS v4
- Supabase PostgreSQL (database only — **not** Supabase Auth)
- Auth.js (next-auth v5) with the Google provider
- Zod for validation
- Mailgun for confirmation email (verified end-to-end: delivered)
- Vercel for deployment

Identity flow: Google Cloud Console → Google OAuth → Auth.js → Next.js session
→ `profiles` row keyed on `google_sub`.

## Local development

### 1. Database

The development database is a local PostgreSQL instance:

```text
postgresql://postgres:postgres@localhost:5432/elite_foods
```

Apply the schema and seed data:

```bash
# schema: 5 tables, RLS, indexes, create_order() RPC
psql postgresql://postgres:postgres@localhost:5432/elite_foods \
  -v ON_ERROR_STOP=1 --single-transaction \
  -f supabase/migrations/0001_init.sql

# seed: 10 products across 3 categories
psql postgresql://postgres:postgres@localhost:5432/elite_foods \
  -v ON_ERROR_STOP=1 --single-transaction \
  -f supabase/seed.sql
```

`--single-transaction` means a failure part-way through leaves the database
unchanged.

`0001_init.sql` is portable across Supabase and plain Postgres: it only revokes
`create_order()` from the `anon` and `authenticated` roles when they exist.

### 2. Environment

```bash
cp .env.example .env.local
```

`.env.local` is gitignored. See `.env.example` for the full variable list,
grouped by the phase that needs it.

### 3. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The home page reports whether it can reach the
database and how many products are seeded.

## Scripts

| Command          | Does                            |
| ---------------- | ------------------------------- |
| `npm run dev`    | Development server              |
| `npm run build`  | Production build                |
| `npm run check`  | Typecheck + lint + format check |
| `npm run format` | Format with Prettier            |

## Money

Every monetary value is a whole Naira integer (`300` = ₦300). No floating-point
arithmetic is used for money. Prices are recomputed on the server at checkout
and are never taken from the browser.

## Placeholder data

Per `AGENTS.md` §27, the following are **not confirmed** and are marked as
placeholders in code:

- All seed prices except Dodo Ikire (₦300 / ₦500 / ₦1,000, from the PRD)
- Product descriptions and images
- The Abeokuta delivery fee
- Shop contact details

Replace them before production use.

## Documentation

- `AGENTS.md` — agent operating manual
- `PRD.md` — product requirements
- `TRD.md` — technical requirements
