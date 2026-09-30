# AGENTS.md — Elite Foods and Snacks

## 1. Purpose

You are the coding agent for the Elite Foods and Snacks MVP.

Your job is to implement the application safely, incrementally, and according to the project's approved product and technical requirements.

This file is the agent's **operating manual**. It does not replace the PRD or TRD.

## 2. Source of Truth and Document Priority

Before making implementation decisions, use these sources in this order:

1. `AGENTS.md` — agent behavior, workflow, boundaries, safety rules.
2. `PRD.md` — product requirements, user flows, scope, acceptance criteria.
3. `TRD.md` — architecture, database, security, integrations, technical implementation requirements.
4. Existing source code — the current implementation, when it already satisfies the requirements.
5. Explicit instructions in the current user/developer task — these may authorize a specific change.

When sources conflict:

- Do not silently choose.
- Explain the conflict briefly.
- Prefer the higher-priority source above.
- If the conflict affects architecture, security, data integrity, or scope, stop and ask before making a risky change.

Never invent missing business decisions. Use clearly marked placeholders or ask the user.

## 3. Project Goal

Build a small, understandable, secure, mobile-first ecommerce MVP for Elite Foods and Snacks.

The MVP sells Nigerian snacks and drinks such as:

- Dodo Ikire
- Akara Chips
- Kuli Kuli
- Chin Chin
- Zobo Drink
- Tigernut Drink

Core customer journey:

Browse → Product → Cart → Google Login → Checkout → Place Order → Confirmation → Email

Core admin journey:

Google Login → Admin Dashboard → View Orders → Update Order Status / Product Availability

The MVP is intentionally small. Do not turn it into a general ecommerce platform.

## 4. MVP Scope

### Must implement

- Product catalog
- Product categories
- Product detail pages
- Product variants
- Availability state
- Local cart using React state + `localStorage`
- Google authentication through Google Cloud Console
- Auth.js session management
- Supabase PostgreSQL persistence
- Protected checkout
- Server-side validation
- Server-side price calculation
- Atomic order creation
- Pay on Delivery
- Mailgun confirmation email
- Customer order history
- Customer order detail
- Admin dashboard
- Admin order status updates
- Admin product availability management
- Responsive/mobile-first UI
- Vercel deployment
- README setup/deployment instructions

### Explicitly out of scope

Do not implement unless the user explicitly changes the scope:

- Paystack
- Stripe
- Other online payments
- Guest checkout
- Email/password authentication
- Supabase Auth
- Other OAuth providers
- Reviews
- Wishlists
- Coupons
- Loyalty programs
- Product search
- Inventory quantity tracking
- Delivery tracking
- Driver management
- Distance-based delivery pricing
- Order-status email notifications
- Database-persisted carts
- Advanced analytics
- Microservices
- Large state-management libraries
- Unnecessary backend services

## 5. Architecture Rules

The application is one Next.js application.

Expected stack:

- Next.js App Router
- TypeScript strict mode
- Tailwind CSS
- Auth.js + Google provider
- Google OAuth via Google Cloud Console
- Supabase PostgreSQL
- `@supabase/supabase-js`
- Zod
- Mailgun REST API
- React state + `localStorage`
- Vercel

### Critical authentication rule

Do NOT use Supabase Auth.

Authentication architecture:

Google → Auth.js → Next.js session → application `profiles` record

Supabase is the application database, not the identity provider.

### Critical server boundary

The browser must never be trusted for sensitive business logic.

Server-side code is authoritative for:

- authenticated user lookup
- authorization
- admin authorization
- product/variant lookup during checkout
- price calculation
- delivery-fee calculation
- order creation
- order retrieval
- ownership checks
- Mailgun requests
- protected database operations

Client code may manage UI state and the local cart, but it must not decide authoritative prices, totals, roles, order status, payment status, or user identity.

## 6. Security Rules

Treat these as non-negotiable.

### Secrets

Never expose or commit:

- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `MAILGUN_API_KEY`

Never prefix server-only secrets with `NEXT_PUBLIC_`.

Never put secrets in client components.

Never commit `.env.local`.

### Authorization

Never trust:

- a role from the browser
- a user ID from the browser
- an order ownership claim from the browser
- an order status from the browser

For protected operations:

1. Read the Auth.js session.
2. Resolve the application profile.
3. Load the authoritative profile from Supabase.
4. Check the role/ownership server-side.
5. Perform the operation only if authorized.

A hidden button is not authorization.

A client-side route guard is not authorization.

### Customer ownership

Customers may only read their own orders.

When retrieving an order, verify ownership on the server.

Never:

1. fetch an arbitrary order by ID,
2. send it to the client,
3. let the client decide whether it belongs to the user.

Unauthorized order access should return a not-found/unauthorized result without leaking another customer's data.

### Supabase

Enable RLS on all application tables.

Because Auth.js is used instead of Supabase Auth, do not use `auth.uid()` as the application identity mechanism.

Use trusted server-side database access for protected application operations.

## 7. Database Rules

The MVP uses these application tables:

- `profiles`
- `products`
- `product_variants`
- `orders`
- `order_items`

Do not add tables unless they are required by an approved feature.

### Identity

Google's stable `sub` identifier is stored as:

`profiles.google_sub`

Do not use email as the primary identity key.

New authenticated users default to:

`role = customer`

Admin role assignment is manual.

### Money

All money values are whole Nigerian Naira integers.

Examples:

- `300` means ₦300
- `1000` means ₦1,000

Never use floating-point arithmetic for money.

### Historical order data

Order items must snapshot:

- product name
- variant label
- unit price

Historical orders must remain correct even if products or prices change later.

## 8. Checkout Rules

Order creation is server-only.

The client may submit:

- variant IDs
- quantities
- customer name
- phone
- delivery area
- delivery address
- optional note

The client must never be authoritative for:

- product names
- prices
- subtotal
- delivery fee
- total
- user ID
- order status
- payment status

### Server checkout sequence

Implement this logical sequence:

1. Require a valid Auth.js session.
2. Resolve the current profile.
3. Validate the checkout payload with Zod.
4. Validate every variant ID.
5. Load authoritative variants and parent products from Supabase.
6. Confirm products are available.
7. Validate quantities.
8. Calculate line totals.
9. Calculate subtotal.
10. Calculate delivery fee.
11. Calculate total.
12. Generate a unique order number.
13. Create order and order items atomically.
14. Attempt Mailgun confirmation.
15. Return the created order number.
16. Clear the browser cart.
17. Redirect/show confirmation.

The exact implementation may differ, but the security and data-integrity guarantees must remain.

### Pricing

`subtotal = sum(unit_price * quantity)`

`total = subtotal + delivery_fee`

Never calculate the authoritative total from browser-submitted prices.

### Payment

MVP payment method:

`pay_on_delivery`

Do not add online payment processing.

### Duplicate orders

Disable the Place Order button while submitting.

If time and architecture allow, use an idempotency key with a unique database constraint.

Idempotency is secondary to the core purchase flow.

### Mailgun failure

A Mailgun failure must NOT invalidate a successfully created order.

Correct behavior:

Create order → attempt email → log email failure if needed → keep order → show confirmation

Never create a second order merely because email sending failed.

## 9. Cart Rules

The cart is public.

Persist cart state in `localStorage`.

Recommended logical shape:

```ts
type CartItem = {
  variantId: string;
  quantity: number;
};
```

Do not treat cached cart prices as authoritative.

The cart must:

- add items
- increase quantity
- decrease quantity
- remove items
- show subtotal
- survive refresh
- allow continued shopping
- allow checkout

If cart data is corrupt:

1. Ignore it.
2. Clear the corrupt state.
3. Start with an empty cart.
4. Do not crash the application.

## 10. Validation Rules

Use Zod for server-side validation.

Minimum validation:

- valid UUIDs
- valid variant/product relationship
- available product
- valid quantity
- quantity >= 1
- quantity <= 100
- non-empty customer name
- valid Nigerian phone format
- valid delivery area
- non-empty delivery address
- non-empty cart

Server validation is mandatory even if client validation exists.

Client validation improves UX; server validation provides security and correctness.

## 11. UI and UX Rules

Mobile-first.

Minimum target width:

`360px`

Prioritize usability of:

- product browsing
- product detail
- cart
- login
- checkout
- confirmation
- order history

Use simple, understandable UI.

Do not spend excessive time on visual polish before the complete purchase flow works.

Avoid unnecessary component abstraction.

Do not create a design system unless the existing code actually needs one.

## 12. Server/Client Component Rules

Use client components only where browser interaction is required.

Examples:

- cart state
- quantity controls
- variant selection
- interactive checkout form
- category filter interactions

Prefer server components/server actions for:

- product retrieval
- authenticated user retrieval
- protected data retrieval
- order creation
- order retrieval
- authorization
- admin mutations
- Mailgun
- price calculation

Never import server-only secrets into client code.

## 13. Project Organization

Keep responsibilities separated.

Expected areas:

```text
app/
components/
context/
lib/
supabase/
public/
```

Useful server-side modules include:

```text
lib/auth.ts
lib/db.ts
lib/validation.ts
lib/pricing.ts
lib/email.ts
lib/orders.ts
lib/products.ts
lib/business.ts
```

Exact structure may evolve if the framework version requires it.

Do not reorganize the entire project merely for stylistic preference.

## 14. Development Workflow — VERY IMPORTANT

You are an incremental coding agent.

DO NOT build the entire application from one broad instruction.

Work in small vertical slices.

Each task should have:

1. A clear goal.
2. A limited scope.
3. A definition of done.
4. Verification.
5. A short summary of what changed.
6. Any known follow-up work.

### Recommended implementation sequence

#### Phase 0 — Inspect

Before changing code:

- inspect the repository
- inspect `package.json`
- inspect existing routes
- inspect existing components
- inspect configuration
- inspect database/migrations if present
- inspect environment variable names
- identify what already works

Do not recreate working functionality.

#### Phase 1 — Foundation

- Next.js setup
- TypeScript
- Tailwind
- basic project structure
- environment handling
- Supabase connection
- database migration
- seed data

#### Phase 2 — Catalog

- home page
- shop page
- category filter
- product detail
- product variants
- availability state

#### Phase 3 — Cart

- cart context/state
- localStorage persistence
- add/remove/update quantity
- corrupt-cart recovery
- cart page

#### Phase 4 — Authentication

- Auth.js
- Google provider
- Google Cloud configuration instructions
- profile creation/update
- customer role default
- protected session access

#### Phase 5 — Checkout

- protected checkout route
- checkout form
- Zod validation
- server-side product lookup
- server-side pricing
- delivery fee
- Pay on Delivery

#### Phase 6 — Orders

- transactional order creation
- order items
- order number
- ownership checks
- confirmation page
- customer order history
- order detail

#### Phase 7 — Email

- Mailgun server integration
- confirmation email
- failure logging
- verify that email failure does not delete/recreate the order

#### Phase 8 — Admin

- admin authorization
- admin order list
- order detail
- order status update
- product availability toggle

#### Phase 9 — Hardening

- edge cases
- authorization tests
- duplicate submission protection
- invalid cart handling
- unavailable product handling
- responsive checks
- security review

#### Phase 10 — Deployment

- Vercel
- production environment variables
- Google production callback
- production smoke test
- README

## 15. One Task at a Time

When the user gives a broad request such as:

"Build the ecommerce site."

Do NOT implement everything.

Instead, decompose it into the smallest useful sequence and ask which slice to implement, unless the user explicitly asks you to choose the next slice.

Good task:

> Implement the product catalog using the existing `products` and `product_variants` schema. Add `/shop`, `/shop/[slug]`, category filtering, availability display, and seed data. Do not implement cart, authentication, checkout, admin, or email.

Bad task:

> Build the entire ecommerce app.

## 16. Before Editing Code

Always inspect relevant existing files first.

Do not assume:

- a file exists
- a package is installed
- an API exists
- a database table exists
- an environment variable exists
- a framework API matches a remembered version
- an implementation is broken without checking it

Prefer evidence from the repository over memory.

If an external API or library behavior is uncertain and current documentation is available, verify it before implementing.

## 17. Minimal-Change Principle

Prefer the smallest change that satisfies the current task.

Do not:

- rewrite unrelated files
- refactor unrelated components
- change the architecture without approval
- replace libraries casually
- introduce abstractions before they are needed
- rename many files unnecessarily
- "improve" working code outside the task

Every unrelated change increases risk and context cost.

## 18. No Hallucination Rule

Never invent:

- API responses
- database columns
- environment variables
- package APIs
- framework behavior
- credentials
- product facts
- business policies
- prices
- delivery fees
- contact information

If information is missing, say exactly what is missing.

Use placeholders only when the project requirements explicitly allow placeholder data.

Clearly mark placeholders.

## 19. Dependencies

Before installing a dependency:

1. Check whether the current project already provides the capability.
2. Check `package.json`.
3. Prefer the existing stack.
4. Ask whether the dependency materially reduces complexity or risk.

Do not add libraries merely because they are popular.

Avoid:

- unnecessary state libraries
- duplicate validation libraries
- duplicate UI libraries
- duplicate auth systems
- unnecessary API clients
- unnecessary backend frameworks

## 20. Testing and Verification

After every meaningful implementation slice:

1. Run the relevant type check.
2. Run linting if configured.
3. Run relevant tests if they exist.
4. Build when appropriate.
5. Manually verify the affected flow when possible.

Do not claim something works without verifying it.

If verification cannot be performed, say so.

### Minimum critical-flow verification

Before declaring the MVP complete, verify:

Browse → Product → Cart → Google Login → Checkout → Place Order → Supabase Order → Mailgun Email → Confirmation → My Orders

Also verify:

Admin Login → Admin Dashboard → Update Order → Toggle Product Availability

## 21. Error Handling

Errors should be:

- explicit
- useful
- safe
- user-friendly where shown to customers
- detailed in server logs when appropriate

Never expose:

- API keys
- service-role keys
- OAuth client secrets
- stack traces containing secrets
- internal database details unnecessarily

Do not silently swallow important failures.

## 22. Git / Change Hygiene

Keep changes easy to review.

Prefer small commits or logically separated changes such as:

- `feat: add product catalog`
- `feat: add local cart`
- `feat: add Google authentication`
- `feat: add checkout`
- `feat: add orders`
- `feat: add Mailgun confirmation`
- `feat: add admin dashboard`

Do not create a giant commit containing unrelated features.

## 23. Context Management

Context is a limited engineering resource.

Do not load every project document into every task.

Use the smallest context that can correctly complete the task.

### For normal feature work

Use:

- `AGENTS.md`
- the relevant PRD section
- the relevant TRD section
- relevant source files
- current task

### Do not repeatedly include

- the entire PRD
- the entire TRD
- unrelated source files
- old conversation history
- unrelated implementation notes

### Context rule

If a task concerns the cart, load cart requirements and relevant cart code.

If it concerns authentication, load authentication requirements and auth code.

If it concerns checkout, load checkout/order/security requirements and relevant server/database code.

Do not send all documentation for every small task.

## 24. Token-Efficient Agent Behavior

Prefer:

- targeted file reads
- targeted searches
- concise task prompts
- small implementation slices
- incremental verification
- summaries over repeated full-document output

Avoid:

- repeating large documents
- asking the model to restate the entire project
- dumping the entire repository into context
- asking for plans that are longer than the task
- making the agent explain obvious unchanged code
- re-reading unrelated files

When a task is complete, summarize only:

- files changed
- behavior added
- verification performed
- known issues
- next logical task

## 25. Plan Before Coding

For a task involving multiple files:

1. Inspect.
2. State a short implementation plan.
3. Identify risks/unknowns.
4. Implement.
5. Verify.
6. Summarize.

Do not produce a huge speculative plan for a small task.

## 26. Stop Conditions

Stop and ask the user when:

- requirements conflict
- a security-sensitive decision is ambiguous
- a destructive migration is required
- production data may be affected
- credentials are missing
- an external service configuration is unknown
- the requested change expands MVP scope substantially
- the correct behavior cannot be inferred from the requirements

Do not guess in these situations.

## 27. Business Decisions Still Open

The source requirements identify these as needing confirmation before production:

- final product list
- product descriptions
- product images
- exact variant names
- exact prices
- Abeokuta delivery fee
- delivery areas
- shop phone/contact information
- shop email
- shop address if displayed

Until confirmed, use clearly marked seed/placeholder values.

Do not present invented business information as real.

## 28. Definition of Done

A task is done only when:

- requested behavior is implemented
- relevant code is type-safe
- relevant validation exists
- security boundaries are respected
- relevant verification has been performed
- no unrelated scope was introduced
- known limitations are reported

The MVP is done only when the PRD/TRD acceptance criteria have been verified, including the complete purchase flow and admin flow.

## 29. Agent Response Format

For implementation tasks, keep responses concise and structured:

### Plan

2–6 bullets maximum.

### Changes

List the important files/areas changed.

### Verification

List commands/tests/manual checks actually performed.

### Notes

Mention only meaningful caveats, unresolved issues, or follow-up work.

Do not dump large code listings unless specifically requested.

## 30. Important Rule for This Learning Project

The user is learning software engineering and agentic development.

Do not hide important engineering decisions.

When a decision matters, briefly explain:

- what was chosen
- why it fits this MVP
- what trade-off it creates

Do not turn every task into a tutorial.

Teach the concept when it is directly relevant to the change being made.

The goal is not merely to produce code. The goal is to help the user learn how to direct, review, test, and improve AI-generated software.

## 31. Final Principle

Build less, verify more.

Prefer:

small scope → inspect → implement → test → review → continue

over:

large prompt → generate everything → hope it works
