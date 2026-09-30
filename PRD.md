# Elite Foods and Snacks — Product Requirements Document (MVP)

**Version:** 1.0  
**Date:** September 30, 2026  
**Project type:** Internship MVP  
**Target deployment:** Vercel

---

## 1. Product Overview

Elite Foods and Snacks is a mobile-first online shop for Nigerian local snacks and drinks such as dodo ikire, akara chips, kuli kuli, chin chin, zobo drink, and tigernut drink.

Customers should be able to:

1. Browse available products.
2. Select product sizes and quantities.
3. Add products to a cart.
4. Sign in with Google.
5. Complete a checkout form.
6. Place an order using Pay on Delivery.
7. Receive an order confirmation email.

The shop owner should be able to:

1. View orders.
2. Update order status.
3. Mark products as available or unavailable.

### Internship requirements

The application must include:

- A shop website.
- A checkout page.
- Persistent application data using Supabase.
- Confirmation emails using Mailgun.
- Google authentication configured through Google Cloud Console.

### MVP goal

A customer should be able to move from browsing products to successfully placing an order and receiving a confirmation email in a simple, reliable flow.

**Deadline:** 2 days.

All implementation decisions should prioritize simplicity and completion of the required functionality.

---

# 2. Goals

## Must accomplish

- Customers can browse products and product variants.
- Customers can add, remove, and change quantities in their cart.
- Customers can authenticate with Google.
- Google OAuth is configured through Google Cloud Console.
- The application manages its own authenticated session using Auth.js.
- Supabase is used as the application database.
- Products, users, orders, and order items are persisted in Supabase.
- Customers can complete checkout.
- Orders are created securely on the server.
- Order prices are recalculated from database values on the server.
- Customers receive confirmation emails through Mailgun.
- Customers can view their previous orders.
- Admins can view and manage orders.
- Admins can mark products available or unavailable.
- The application is deployed to Vercel.
- A README explains setup and deployment.

---

# 3. Non-Goals

The following are explicitly outside the MVP:

- Online payment.
- Paystack or Stripe integration.
- Guest checkout.
- Email/password authentication.
- Authentication providers other than Google.
- Supabase Auth.
- Product reviews.
- Wishlists.
- Coupons or discount codes.
- Loyalty programs.
- Product search.
- Stock quantity tracking.
- Delivery tracking.
- Driver management.
- Automatic delivery pricing by distance.
- Order-status email notifications.
- Saved carts in the database.
- Advanced analytics.
- Multiple admin roles.
- Microservices.

These may be considered future enhancements but should not be implemented as part of the 2-day MVP.

---

# 4. Target Users

## Customer

A person purchasing Nigerian snacks or drinks for personal use, family, gifts, events, or other purposes.

### Needs

- Simple mobile shopping experience.
- Clear product names, descriptions, sizes, and prices.
- Fast checkout.
- Reliable order confirmation.

## Admin

The shop owner or authorized shop administrator.

### Needs

- View incoming orders.
- View customer and delivery information.
- Update order status.
- Control product availability.

There are only two application roles:

- `customer`
- `admin`

A newly authenticated user is a `customer` by default.

The admin role is assigned manually to the shop owner's profile.

---

# 5. Core Features

## 5.1 Product Catalog

Customers can browse products grouped into simple categories.

Initial categories:

- Fried Snacks
- Nuts and Grains
- Drinks

Example products:

- Dodo Ikire
- Akara Chips
- Kuli Kuli
- Chin Chin
- Zobo Drink
- Tigernut Drink

Products may have multiple variants/sizes.

Example:

| Product    | Variant |  Price |
| ---------- | ------- | -----: |
| Dodo Ikire | Small   |   ₦300 |
| Dodo Ikire | Medium  |   ₦500 |
| Dodo Ikire | Large   | ₦1,000 |

Exact products, variants, prices, descriptions, and images are configurable seed data.

---

## 5.2 Product Availability

Each product has an availability state:

- Available
- Unavailable

Unavailable products:

- Remain visible in the catalog.
- Are clearly marked as unavailable/sold out.
- Cannot be added to the cart.
- Cannot be ordered if they become unavailable after being added to the cart.

The MVP does not track exact inventory quantities.

---

## 5.3 Product Detail

Each product detail page must show:

- Product image.
- Product name.
- Description.
- Available variants/sizes.
- Price for each variant.
- Quantity selector.
- Add to Cart button.

The customer must select a valid variant before adding the product to the cart.

---

## 5.4 Cart

The cart is public and does not require authentication.

Customers can:

- View cart items.
- Change quantities.
- Remove items.
- View subtotal.
- Continue shopping.
- Proceed to checkout.

Cart state is stored in browser `localStorage`.

The cart must survive a page refresh.

The cart must not store authoritative prices. Prices shown during checkout are recalculated from the database.

---

# 6. Authentication

## Authentication architecture

Google OAuth must be configured through **Google Cloud Console**.

The application must use **Auth.js** to manage authentication and sessions.

**Supabase Auth must not be used.**

Responsibilities:

| System               | Responsibility                             |
| -------------------- | ------------------------------------------ |
| Google Cloud Console | OAuth application and Google credentials   |
| Google               | Identity provider                          |
| Auth.js              | OAuth flow and application session         |
| Next.js              | Authentication callbacks and authorization |
| Supabase             | Application database                       |
| Mailgun              | Transactional email                        |

### Authentication flow

1. Customer clicks `Continue with Google`.
2. Auth.js redirects the customer to Google.
3. Google authenticates the customer.
4. Google redirects back to the application's Auth.js callback.
5. Auth.js creates the application session.
6. The application finds or creates the corresponding `profiles` record.
7. The customer is redirected to the requested page.

Google's unique user identifier (`sub`) must be stored as `google_sub`.

The application must not use Google's email address as the primary identity key.

---

# 7. Authorization

Authentication determines **who the user is**.

Authorization determines **what the user can do**.

## Customer

A customer can:

- Browse products.
- Manage their local cart.
- Create orders.
- View their own orders.
- View their own profile information.

A customer cannot:

- View another customer's orders.
- Access the admin dashboard.
- Change their own role.
- Modify product data.

## Admin

An admin can:

- View all orders.
- View order details.
- Update order status.
- Mark products available/unavailable.

Admin authorization must be checked on the server.

A client-side check alone is not sufficient.

---

# 8. Pages and Routes

| Route                       | Page            | Access                 |
| --------------------------- | --------------- | ---------------------- |
| `/`                         | Home            | Public                 |
| `/shop`                     | Shop            | Public                 |
| `/shop/[slug]`              | Product detail  | Public                 |
| `/cart`                     | Cart            | Public                 |
| `/login`                    | Login           | Public                 |
| `/checkout`                 | Checkout        | Authenticated customer |
| `/orders`                   | My Orders       | Authenticated customer |
| `/orders/[id]`              | Order detail    | Order owner/admin      |
| `/orders/[id]/confirmation` | Confirmation    | Order owner/admin      |
| `/admin`                    | Admin dashboard | Admin                  |

## Home

Must contain:

- Shop branding.
- Short introduction.
- Featured products.
- Link to shop.
- Basic explanation of how ordering works.
- Contact information.
- Delivery information.

## Shop

Must contain:

- Product grid.
- Product images.
- Product names.
- Starting or selected variant price.
- Category filtering.
- Availability state.

## Product Detail

Must contain:

- Product information.
- Variant selector.
- Price.
- Quantity selector.
- Add to Cart.

## Cart

Must contain:

- Cart items.
- Selected variant.
- Quantity.
- Unit price.
- Item total.
- Subtotal.
- Checkout button.

## Login

Must contain:

- `Continue with Google` button.
- Clear authentication error state.

No email/password login.

## Checkout

Must contain:

- Customer name.
- Phone number.
- Delivery address.
- Delivery area.
- Optional order note.
- Order summary.
- Delivery fee.
- Total.
- Payment method: Pay on Delivery.
- Place Order button.

## My Orders

Customers can see their own orders with:

- Order number.
- Date.
- Total.
- Status.

## Order Detail

Must show:

- Order number.
- Items.
- Variant/size.
- Quantity.
- Unit price.
- Subtotal.
- Delivery fee.
- Total.
- Delivery information.
- Payment method.
- Order status.

## Confirmation

After a successful order:

- Show order number.
- Show order summary.
- Show total.
- Confirm that the order was successfully placed.
- Tell the customer that a confirmation email was sent.

## Admin Dashboard

Must provide:

- Orders list.
- Order details.
- Order status update.
- Product availability management.

---

# 9. Primary User Flow

## Purchase Flow

1. Customer opens the website.
2. Customer browses the shop.
3. Customer opens a product.
4. Customer selects a variant and quantity.
5. Customer adds the item to the cart.
6. Customer reviews the cart.
7. Customer clicks Checkout.
8. If unauthenticated, customer is redirected to Google sign-in.
9. After successful authentication, customer returns to checkout.
10. Customer enters delivery information.
11. Customer reviews the order.
12. Customer clicks Place Order.
13. The server validates the request.
14. The server retrieves authoritative product and variant data from Supabase.
15. The server recalculates the subtotal and total.
16. The server creates the order and order items atomically.
17. The server sends a confirmation email through Mailgun.
18. The cart is cleared.
19. Customer is redirected to the confirmation page.

If Mailgun fails, the order remains successful. Email failure must not cause an otherwise valid order to be lost.

---

# 10. Admin Flow

1. Admin signs in with Google.
2. Application identifies the user's `admin` role.
3. Admin opens `/admin`.
4. Admin sees orders, newest first.
5. Admin opens an order.
6. Admin can change its status.
7. Admin can manage product availability.

Allowed order statuses:

- `pending`
- `confirmed`
- `out_for_delivery`
- `delivered`
- `cancelled`

---

# 11. Returning Customer Flow

1. Customer signs in with Google.
2. Customer opens My Orders.
3. Customer sees their previous orders.
4. Customer can open an order to view its details.

Customer profile information such as name, email, and phone may be reused to prefill checkout.

This is optional if time is limited.

---

# 12. Checkout and Business Rules

## Currency

All prices are stored as whole-number integers representing Nigerian Naira.

Example:

```text
300 = ₦300
1000 = ₦1,000
```

Do not use floating-point numbers for monetary values.

## Payment

MVP payment method:

```text
pay_on_delivery
```

No online payment processing is required.

## Delivery

For the MVP, delivery pricing should use a simple configurable rule.

Default:

- Abeokuta: flat delivery fee configured in application settings.

The actual fee must be confirmed before production use.

Additional locations can be added later without redesigning the order model.

## Order totals

The server calculates:

```text
subtotal = Σ(unit_price × quantity)

total = subtotal + delivery_fee
```

Prices supplied by the browser are never trusted.

## Product availability

The server must verify that every ordered product is currently available.

## Phone number

Accept common Nigerian mobile formats such as:

```text
08012345678
+2348012345678
```

The server must validate the submitted value.

## Order number

Each order receives a unique human-readable number, for example:

```text
EFS-000123
```

## Initial order state

New orders start as:

```text
status = pending
payment_status = unpaid
```

---

# 13. Database Design

Supabase PostgreSQL stores all persistent application data.

The MVP uses five application tables.

## `profiles`

| Field        | Purpose                         |
| ------------ | ------------------------------- |
| `id`         | Internal application user ID    |
| `google_sub` | Google's unique user identifier |
| `email`      | Customer email                  |
| `full_name`  | Customer name                   |
| `phone`      | Customer phone                  |
| `role`       | `customer` or `admin`           |
| `created_at` | Creation timestamp              |
| `updated_at` | Last update timestamp           |

`google_sub` must be unique.

## `products`

| Field          | Purpose                        |
| -------------- | ------------------------------ |
| `id`           | Product ID                     |
| `name`         | Product name                   |
| `slug`         | URL-friendly unique identifier |
| `description`  | Product description            |
| `category`     | Product category               |
| `image_url`    | Product image                  |
| `is_available` | Availability flag              |
| `created_at`   | Creation timestamp             |

## `product_variants`

| Field        | Purpose              |
| ------------ | -------------------- |
| `id`         | Variant ID           |
| `product_id` | Parent product       |
| `label`      | Size/variant label   |
| `price`      | Price in whole Naira |

A product must have at least one variant.

## `orders`

| Field              | Purpose                            |
| ------------------ | ---------------------------------- |
| `id`               | Order ID                           |
| `order_number`     | Human-readable unique order number |
| `user_id`          | Customer profile ID                |
| `status`           | Order status                       |
| `payment_method`   | Payment method                     |
| `payment_status`   | Payment state                      |
| `delivery_area`    | Delivery area                      |
| `delivery_address` | Delivery address                   |
| `customer_name`    | Name captured at checkout          |
| `customer_phone`   | Phone captured at checkout         |
| `customer_email`   | Email captured at checkout         |
| `note`             | Optional customer note             |
| `subtotal`         | Calculated subtotal                |
| `delivery_fee`     | Delivery fee                       |
| `total`            | Final total                        |
| `created_at`       | Creation timestamp                 |

## `order_items`

| Field           | Purpose               |
| --------------- | --------------------- |
| `id`            | Order item ID         |
| `order_id`      | Parent order          |
| `variant_id`    | Ordered variant       |
| `product_name`  | Product name snapshot |
| `variant_label` | Variant snapshot      |
| `unit_price`    | Price snapshot        |
| `quantity`      | Ordered quantity      |

Product name, variant label, and price are copied into the order item so historical orders do not change when products are later edited.

---

# 14. Database Relationships

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

- One profile can have many orders.
- One order can have many order items.
- One product can have many variants.
- One variant belongs to one product.
- One order item references one product variant.

---

# 15. Database Security

Row Level Security must be enabled on all Supabase tables.

Because the application uses **Auth.js instead of Supabase Auth**, Supabase's `auth.uid()` must not be used as the application's identity mechanism.

Protected application data is accessed through trusted Next.js server-side code.

The server must:

1. Read the Auth.js session.
2. Identify the authenticated application user.
3. Check resource ownership.
4. Check the user's role where necessary.
5. Perform the database operation using the server-side Supabase client.

The Supabase service-role key:

- Must only exist on the server.
- Must never be exposed to client-side JavaScript.
- Must never be prefixed with `NEXT_PUBLIC_`.
- Must never be committed to Git.

Public product reads may use a restricted Supabase client or server-side access.

---

# 16. Order Creation

Order creation must happen on the server.

The browser sends only the information necessary to identify:

- Selected variant IDs.
- Quantities.
- Delivery information.
- Customer note.

The browser must not be trusted for:

- Product names.
- Prices.
- Subtotals.
- Delivery fees.
- Totals.
- User IDs.
- Order status.
- Payment status.

The server retrieves authoritative product data and calculates the order.

Order and order-item creation should happen atomically so that a failed operation does not leave a partially created order.

---

# 17. Idempotency and Duplicate Orders

The Place Order button must be disabled while a request is being processed.

The server should also protect against accidental duplicate submissions.

If time permits, use a unique idempotency key for each checkout submission so that a retried request returns the existing order instead of creating another one.

This is desirable but secondary to the core MVP requirements.

---

# 18. Mailgun Integration

Confirmation emails are sent from server-side code only.

The email must contain:

- Shop name.
- Order number.
- Customer name.
- Ordered products.
- Variant/size.
- Quantity.
- Unit prices.
- Subtotal.
- Delivery fee.
- Total.
- Delivery address.
- Payment method.
- Shop contact information.

A simple HTML email is sufficient.

### Failure behaviour

If Mailgun fails:

1. The order remains successfully stored.
2. The customer still sees the confirmation page.
3. The server logs the email failure.
4. The application must not create a second order simply because email failed.

Mailgun credentials must never reach the browser.

---

# 19. Google OAuth Configuration

Create the OAuth application in Google Cloud Console.

Required configuration:

1. Create/select a Google Cloud project.
2. Configure the OAuth consent screen.
3. Create an OAuth Client ID.
4. Client type: Web application.
5. Configure authorized redirect URIs for local development and production.
6. Configure the required application origin/URL settings.
7. Store the Google client ID and secret as environment variables.
8. Configure Auth.js with the Google provider.

Example local callback:

```text
http://localhost:3000/api/auth/callback/google
```

Production callback should use the deployed application's domain.

The exact production URL must be configured when the application is deployed.

---

# 20. Environment Variables

Server secrets must never be committed to source control.

Expected environment variables include:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

SUPABASE_SERVICE_ROLE_KEY

GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET

AUTH_SECRET

MAILGUN_API_KEY
MAILGUN_DOMAIN
MAILGUN_FROM_EMAIL

NEXT_PUBLIC_SITE_URL
```

Only variables that genuinely need to be exposed to the browser may use the `NEXT_PUBLIC_` prefix.

---

# 21. Edge Cases

| Situation                                     | Expected behaviour                                               |
| --------------------------------------------- | ---------------------------------------------------------------- |
| Empty cart at checkout                        | Redirect to cart                                                 |
| User is not authenticated                     | Redirect to Google login                                         |
| Google authentication fails/cancelled         | Return to login with a clear message                             |
| Cart survives refresh                         | Restore valid localStorage cart                                  |
| Corrupt cart data                             | Clear invalid cart and continue                                  |
| Product becomes unavailable after being added | Reject checkout and identify the product                         |
| Browser submits manipulated price             | Ignore browser price and use database price                      |
| Invalid quantity                              | Reject request                                                   |
| Quantity is zero or negative                  | Reject request                                                   |
| Invalid variant ID                            | Reject request                                                   |
| Invalid phone number                          | Show validation error                                            |
| Double-click Place Order                      | Prevent duplicate submission                                     |
| Duplicate/retried order request               | Return existing order when idempotency protection is implemented |
| Database transaction fails                    | No partial order should remain                                   |
| Mailgun fails                                 | Keep order; log email failure                                    |
| Customer opens another customer's order       | Return unauthorized/not found                                    |
| Customer accesses admin route                 | Deny access                                                      |
| Non-admin attempts admin API operation        | Reject server-side                                               |
| Product has no image                          | Display placeholder                                              |
| Session expires during checkout               | Require authentication again without trusting stale identity     |
| Product is deleted/changed after an order     | Historical order retains its stored item snapshot                |

---

# 22. Responsive Requirements

The application is mobile-first.

It must work at:

- 360px width and above.
- Desktop widths.

The primary shopping flow must be comfortable on a mobile phone.

Optimize product images and avoid unnecessarily large assets because customers may use mobile data.

---

# 23. Technical Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| Framework         | Next.js                             |
| Language          | TypeScript                          |
| Routing           | Next.js App Router                  |
| Styling           | Tailwind CSS                        |
| Authentication    | Auth.js + Google provider           |
| Identity provider | Google OAuth / Google Cloud Console |
| Database          | Supabase PostgreSQL                 |
| Email             | Mailgun                             |
| Hosting           | Vercel                              |
| Cart              | React state + `localStorage`        |

## Architectural constraint

Use one Next.js application.

Do not introduce:

- Separate backend service.
- Microservices.
- Redis.
- Unnecessary state-management libraries.
- Unnecessary abstractions.

Keep the implementation understandable and appropriate for a 2-day MVP.

---

# 24. Project Structure Expectations

The implementation should follow a conventional Next.js App Router structure.

Keep responsibilities separated:

```text
app/
components/
lib/
  auth/
  db/
  email/
  validation/
  orders/
```

The exact structure may be adjusted when implementation begins, but:

- Authentication logic should not be mixed into UI components.
- Database access should not be scattered throughout the UI.
- Email sending should be server-only.
- Order calculation and validation should be server-only.
- Admin authorization should be server-side.

---

# 25. Acceptance Criteria

The MVP is complete when:

### Shopping

- [ ] Customer can browse products.
- [ ] Customer can filter products by category.
- [ ] Customer can view product details.
- [ ] Customer can select a variant.
- [ ] Customer can select quantity.
- [ ] Customer can add products to cart.
- [ ] Customer can modify cart quantities.
- [ ] Customer can remove cart items.
- [ ] Cart survives page refresh.
- [ ] Unavailable products cannot be ordered.

### Authentication

- [ ] Customer can sign in with Google.
- [ ] Google OAuth is configured through Google Cloud Console.
- [ ] Auth.js manages the application session.
- [ ] Supabase Auth is not used.
- [ ] A profile is created or updated after authentication.
- [ ] Users cannot modify their own role.
- [ ] Authentication works on the deployed application.

### Checkout

- [ ] Unauthenticated customers are redirected to login before checkout.
- [ ] Checkout preserves the cart after authentication.
- [ ] Customer can enter delivery information.
- [ ] Pay on Delivery is available.
- [ ] Order totals are calculated server-side.
- [ ] Browser-submitted prices are ignored.
- [ ] Invalid orders are rejected.
- [ ] Order and order items are stored atomically.

### Orders

- [ ] Customer receives a unique order number.
- [ ] Customer can view their own orders.
- [ ] Customer cannot view another customer's orders.
- [ ] Order status can be viewed.
- [ ] Admin can view all orders.
- [ ] Admin can update order status.
- [ ] Admin can manage product availability.

### Email

- [ ] Confirmation email is sent through Mailgun.
- [ ] Email contains correct order information.
- [ ] Mailgun credentials are server-only.
- [ ] Email failure does not destroy a successfully created order.

### Security

- [ ] Supabase RLS is enabled.
- [ ] Supabase service-role key is server-only.
- [ ] Google client secret is server-only.
- [ ] Mailgun API key is server-only.
- [ ] Admin authorization is enforced server-side.
- [ ] Customer order ownership is enforced server-side.

### Deployment

- [ ] Application is deployed to Vercel.
- [ ] Production Google OAuth redirect URI is configured.
- [ ] Production environment variables are configured.
- [ ] Production purchase flow has been tested.
- [ ] README contains setup instructions.
- [ ] Application works at 360px width.

---

# 26. Seed Data

The MVP should contain approximately 8–10 products distributed across the initial categories.

Example:

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

Each product should have only the variants that make sense for that product.

Do not invent unrealistic product variants simply to satisfy a fixed count.

Exact prices, product descriptions, images, and contact information remain open until confirmed.

---

# 27. Build Order

The implementation should proceed in this order.

## Day 1 — Foundation and shopping flow

1. Create Next.js application.
2. Configure TypeScript and Tailwind.
3. Create Supabase project.
4. Create database schema.
5. Configure RLS.
6. Seed products.
7. Configure Auth.js.
8. Configure Google OAuth in Google Cloud Console.
9. Implement authentication.
10. Build home page.
11. Build shop page.
12. Build product detail page.
13. Build cart.
14. Implement localStorage cart persistence.

## Day 2 — Checkout, orders, email, admin

1. Build protected checkout.
2. Implement server-side validation.
3. Implement server-side price calculation.
4. Implement transactional order creation.
5. Build confirmation page.
6. Build My Orders.
7. Configure Mailgun.
8. Implement confirmation email.
9. Build admin dashboard.
10. Implement order status updates.
11. Implement product availability management.
12. Deploy to Vercel.
13. Configure production environment variables.
14. Configure production Google OAuth redirect.
15. Test complete production flow.
16. Write README.

The purchase flow should be tested end-to-end before spending time on visual polish.

---

# 28. Open Business Decisions

The following information should be confirmed before production use:

- Final product list.
- Product descriptions.
- Product images.
- Exact variant names.
- Exact prices.
- Abeokuta delivery fee.
- Delivery areas.
- Shop phone/contact information.
- Shop email address.
- Shop address, if it will be displayed.

Until confirmed, use clearly marked seed/placeholder values.

---

# 29. Definition of Done

The project is considered complete when a reviewer can:

1. Open the deployed website.
2. Browse the product catalog.
3. Select a product and variant.
4. Add it to the cart.
5. Sign in using Google.
6. Complete checkout.
7. Place an order.
8. Verify that the order exists in Supabase.
9. Receive the Mailgun confirmation email.
10. View the order in My Orders.
11. Sign in as the admin.
12. View the order in the admin dashboard.
13. Change its status.
14. Mark a product unavailable.
15. Confirm that the unavailable product cannot be ordered.

The implementation should remain small, understandable, secure, and focused on demonstrating the required technologies rather than building a production-scale ecommerce platform.
