-- =============================================================================
-- Elite Foods and Snacks — initial schema (TRD section 6)
-- =============================================================================
--
-- Apply with the Supabase CLI:
--   supabase db push
--
-- Money rule: every monetary column is a whole Naira INTEGER.
-- `300` means ₦300. Never introduce numeric/decimal money columns.
--
-- Identity rule: Google's stable `sub` is the identity key
-- (`profiles.google_sub`), not the email address (TRD section 4.2).
--
-- Auth rule: Supabase Auth is NOT used. RLS is enabled on every table with no
-- anon/authenticated policies, so the only client that can read or write these
-- tables is the trusted server-side code using the service-role key. All
-- ownership and role checks happen in Next.js server code (TRD section 8.1).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  google_sub text not null unique,
  email text not null,
  full_name text,
  phone text,
  -- Admin is assigned manually in the database, never from the browser
  -- (AGENTS.md section 7).
  role text not null default 'customer'
    check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.google_sub is
  'Google account stable identifier (provider account.sub). Primary identity key.';
comment on column public.profiles.role is
  'Manually assigned. New authenticated users default to customer.';

-- -----------------------------------------------------------------------------
-- products
-- -----------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  category text not null
    check (category in ('fried-snacks', 'nuts-and-grains', 'drinks')),
  image_url text,
  -- The MVP tracks availability only, not inventory quantities (TRD section 21).
  is_available boolean not null default true,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- product_variants
-- -----------------------------------------------------------------------------
create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  label text not null,
  -- Whole Naira integer (TRD section 6.3).
  price integer not null check (price > 0)
);

create index product_variants_product_id_idx
  on public.product_variants(product_id);

-- -----------------------------------------------------------------------------
-- orders
-- -----------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  -- Guards against duplicate orders from a retried submission (TRD section 11).
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
  -- All whole Naira integers.
  subtotal integer not null check (subtotal >= 0),
  delivery_fee integer not null check (delivery_fee >= 0),
  total integer not null check (total >= 0),
  created_at timestamptz not null default now()
);

create index orders_user_created_idx
  on public.orders(user_id, created_at desc);

create index orders_created_idx
  on public.orders(created_at desc);

-- -----------------------------------------------------------------------------
-- order_items
-- -----------------------------------------------------------------------------
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  -- Historical snapshot. If a product is later renamed or repriced, an old
  -- order must still show what was actually bought (AGENTS.md section 7).
  product_name text not null,
  variant_label text not null,
  unit_price integer not null check (unit_price > 0),
  quantity integer not null check (quantity between 1 and 100)
);

create index order_items_order_id_idx
  on public.order_items(order_id);

-- =============================================================================
-- Order numbers (TRD section 12)
-- =============================================================================
-- A sequence guarantees uniqueness, which a random generator would not.
create sequence public.order_number_seq start 1;

create or replace function public.next_order_number()
returns text
language sql
volatile
as $$
  select 'EFS-' || lpad(nextval('public.order_number_seq')::text, 6, '0');
$$;

comment on function public.next_order_number() is
  'Generates a unique human-readable order number such as EFS-000123.';

-- =============================================================================
-- Atomic order creation (TRD section 10)
-- =============================================================================
-- Creates the order and its items inside ONE transaction. If any item insert
-- fails, the whole thing rolls back, so an order can never exist without its
-- items.
--
-- All values passed in have already been validated and priced by Next.js server
-- code. This function performs no pricing and trusts no browser input.
create or replace function public.create_order(
  p_user_id uuid,
  p_delivery_area text,
  p_delivery_address text,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_note text,
  p_subtotal integer,
  p_delivery_fee integer,
  p_total integer,
  p_idempotency_key uuid,
  p_items jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
begin
  -- Retried submission with the same key: return the original order rather
  -- than creating a duplicate (TRD section 11).
  if p_idempotency_key is not null then
    select * into v_order
    from public.orders
    where idempotency_key = p_idempotency_key;

    if found then
      return v_order;
    end if;
  end if;

  insert into public.orders (
    order_number,
    idempotency_key,
    user_id,
    delivery_area,
    delivery_address,
    customer_name,
    customer_phone,
    customer_email,
    note,
    subtotal,
    delivery_fee,
    total
  )
  values (
    public.next_order_number(),
    p_idempotency_key,
    p_user_id,
    p_delivery_area,
    p_delivery_address,
    p_customer_name,
    p_customer_phone,
    p_customer_email,
    nullif(p_note, ''),
    p_subtotal,
    p_delivery_fee,
    p_total
  )
  returning * into v_order;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.order_items (
      order_id,
      variant_id,
      product_name,
      variant_label,
      unit_price,
      quantity
    )
    values (
      v_order.id,
      (v_item->>'variantId')::uuid,
      v_item->>'productName',
      v_item->>'variantLabel',
      (v_item->>'unitPrice')::integer,
      (v_item->>'quantity')::integer
    );
  end loop;

  return v_order;
end;
$$;

comment on function public.create_order is
  'Atomically creates an order and its items. Call with server-validated values only.';

-- Only the service role (server code) may create orders.
-- NOTE: the `anon` and `authenticated` roles are created by Supabase, not by
-- vanilla Postgres. This statement is therefore Supabase-specific and will fail
-- on a plain Postgres instance. That is intentional: this migration targets
-- Supabase only (TRD section 6).
revoke execute on function public.create_order from public, anon, authenticated;

-- =============================================================================
-- Row Level Security (TRD section 8.1)
-- =============================================================================
-- RLS is enabled on all five application tables.
--
-- No anon or authenticated policies are created on purpose. Because Supabase
-- Auth is not used, there is no Supabase session to write a policy against, and
-- every read/write goes through Next.js server code using the service-role key
-- (which bypasses RLS). With RLS enabled and no policies, any key other than
-- the service role is denied access, which is the desired default.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Keep updated_at honest.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_updated_at();
