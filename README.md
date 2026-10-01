# Elite Foods and Snacks

Mobile-first ecommerce MVP for a Nigerian snacks and drinks shop. Browse →
Cart → Google Login → Checkout → Pay on Delivery or Bank Transfer →
Confirmation email → Order history.

Status: **customer purchase journey and admin dashboard complete.** Catalog,
local cart, Google authentication, checkout, atomic order creation, Mailgun
confirmation email, customer order history, and the admin dashboard (order
status updates, product and variant management, availability toggles) are built
and verified against the live Supabase project.

## Stack

- Next.js 16 (App Router, Turbopack), TypeScript strict, Tailwind CSS v4
- Supabase PostgreSQL (database only — **not** Supabase Auth), accessed through
  the service-role REST API with RLS enabled and no client policies
- Auth.js (next-auth v5) with the Google provider
- Zod for validation
- Mailgun for confirmation email (verified end-to-end: delivered)
- Supabase CLI for migrations (hosted project — no local Postgres)
- Vercel for deployment

Identity flow: Google Cloud Console → Google OAuth → Auth.js → Next.js session
→ `profiles` row keyed on `google_sub`.

## Local development

There is no local Postgres server. Development and production both run against a
**hosted Supabase project**, and schema changes are applied with the Supabase
CLI over that connection. Nothing in this repo needs `psql`.

### 1. Link the Supabase project

The Supabase CLI is a dev dependency (`supabase@^2.118.0`).

```bash
# once per machine: authenticate the CLI
npx supabase login

# point the CLI at the project (writes supabase/.temp/, which is gitignored)
npx supabase link --project-ref <project-ref>
```

The project ref is also recorded in `supabase/.temp/project-ref`.

### 2. Database

Migrations in `supabase/migrations/` are applied in filename order. `0001` builds
the schema; `0002` adds the second payment method.

```bash
# apply any migrations not yet on the project
npx supabase db push --linked

# preview first without changing anything
npx supabase db push --linked --dry-run

# see what is applied where
npx supabase migration list --linked
```

`supabase/config.toml` sets `[db.seed]` with `sql_paths = ["./seed.sql"]`, so
seed data runs from the same config:

```bash
npx supabase db push --linked --include-seed
```

To load the schema and seed onto an empty project:

```bash
npx supabase db reset --linked
```

`supabase/seed.sql` is safe to re-run: products use `on conflict (slug) do
nothing`, and variants use a `where not exists` guard, so re-seeding will not
duplicate rows. It seeds 10 products across 3 categories.

**The application never connects to Postgres directly.** Server code uses the
service-role key against Supabase's REST API, and row-level security stays
enabled on all five tables with no client policies — so any key other than the
service role is denied by default.

### 3. Environment

```bash
cp .env.example .env.local
```

`.env.local` is gitignored. See `.env.example` for the full variable list,
grouped by the phase that needs it.

### 4. Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The storefront reads live catalog data, so an
admin change to availability is visible on the next request.

## Scripts

| Command                                        | Does                            |
| ---------------------------------------------- | ------------------------------- |
| `npm run dev`                                  | Development server              |
| `npm run build`                                | Production build                |
| `npm run check`                                | Typecheck + lint + format check |
| `npm run format`                               | Format with Prettier            |
| `npx supabase db push --linked`                | Apply migrations                |
| `npx supabase db push --linked --include-seed` | Apply migrations + seed         |
| `npx supabase migration list --linked`         | Migration status                |

## Money

Every monetary value is a whole Naira integer (`300` = ₦300). No floating-point
arithmetic is used for money. Prices are recomputed on the server at checkout
and are never taken from the browser.

## Payment methods

Defined once in `src/lib/config/business.ts` and derived everywhere else:

- **Pay on delivery** — pay the rider in cash on arrival.
- **Bank transfer** — transfer to the business account; the order stays _unpaid_
  until an admin verifies it by hand. There is no automatic bank reconciliation.

The chosen method is stored on `orders.payment_method`, enforced by a database
check constraint and narrowed again inside `create_order()`. Method strings are
never duplicated: the Zod schema is derived from the shared enum.

## Placeholder data

Per `AGENTS.md` §27, the following are **not confirmed** and are marked as
placeholders in code:

- All seed prices except Dodo Ikire (₦300 / ₦500 / ₦1,000, from the PRD)
- Product descriptions and imagery (temporary illustrations in `public/products/`)
- The Abeokuta delivery fee
- Shop contact details
- **Bank transfer details** in `BANK_TRANSFER` (`src/lib/config/business.ts`).
  Checkout shows a warning while these are placeholders so nobody can pay an
  account that does not exist.

Replace them before production use.

## Design

Light-first "Sachet & Mango" system: Outfit + DM Sans, pale zobo blush canvas,
white cards, Elite red as the primary brand colour, mango→coral gradients for
energy. Dark mode is opt-in via a header toggle and persists to `localStorage`;
the OS preference is deliberately ignored, so a first-time visitor always sees
light. Tokens, roles and contrast requirements are documented in
`src/app/globals.css`.

## Documentation

- `AGENTS.md` — agent operating manual
- `PRD.md` — product requirements
- `TRD.md` — technical requirements
