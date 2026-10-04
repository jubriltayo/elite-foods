-- 0003_cart.sql
--
-- Server-side cart.
--
-- A signed-out customer keeps their cart in localStorage. A signed-in customer
-- keeps it here, so the same cart is visible on every device they use,
-- including the mobile app.
--
-- The cart persists ONLY a variant reference and a quantity. No price, product
-- name or availability is stored with it: every read resolves current
-- products/product_variants rows and computes the subtotal in application code,
-- so a cart can never carry a stale price (AGENTS.md section 9).
--
-- Two database functions are provided, following the create_order() idiom:
--   set_cart_items()   replace semantics; the client's list is the new truth
--   merge_cart_items() additive semantics; used when a device cart is merged
--                      into the server cart on sign-in
--
-- Both are written as explicit loops rather than set-based INSERT ... SELECT
-- because a malformed uuid would abort a set-based ::uuid cast. Here every cast
-- is preceded by a shape check, so one bad row is skipped instead of failing the
-- whole request.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  -- One cart per customer. Deleting the profile removes the cart with it.
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.carts is
  'One saved cart per customer. Stores no prices; totals are computed on read.';

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts(id) on delete cascade,
  -- Nullable with ON DELETE SET NULL, deliberately matching order_items.
  --
  -- When an admin deletes a variant that a customer still holds, ON DELETE
  -- CASCADE would remove the line with no trace and the cart would silently
  -- shrink. SET NULL retains the line as a "dead line" so cart read can report
  -- variant_missing and the customer can be told why their cart changed.
  variant_id uuid references public.product_variants(id) on delete set null,
  quantity integer not null check (quantity between 1 and 100),
  created_at timestamptz not null default now(),
  unique (cart_id, variant_id)
);

comment on table public.cart_items is
  'Cart lines. A null variant_id is a dead line: the variant was deleted and the line cannot be ordered.';

create index cart_items_cart_id_idx
on public.cart_items(cart_id);

-- Postgres treats NULLs as distinct in a unique constraint, so one cart may
-- hold several dead lines. That is intended; no extra constraint is added.

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
-- Enabled with no client policies, matching every other application table. The
-- service role bypasses RLS, and every caller in application code filters by the
-- resolved profile, so any key other than the service role is denied by default.

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;

-- ---------------------------------------------------------------------------
-- 3. set_cart_items(): replace
-- ---------------------------------------------------------------------------
-- The submitted list becomes the entire cart. Any line not present is deleted,
-- INCLUDING dead lines, because the client's list is the new truth.

create function public.set_cart_items(
  p_user_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart_id uuid;
  v_row record;
  v_id_text text;
  v_qty_text text;
  v_qty integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  insert into public.carts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select id into v_cart_id
  from public.carts
  where user_id = p_user_id;

  -- Replace, not merge: clear the cart first. This is what removes dead lines.
  delete from public.cart_items where cart_id = v_cart_id;

  for v_row in
    select e.value as item
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as e(value)
  loop
    v_id_text := lower(v_row.item ->> 'variantId');
    v_qty_text := v_row.item ->> 'quantity';

    -- Shape checks first. No cast is attempted on input that has not passed.
    if v_id_text is null
       or v_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      continue;
    end if;

    if v_qty_text is null or v_qty_text !~ '^[0-9]+$' then
      continue;
    end if;

    v_qty := v_qty_text::integer;

    -- MAX_QUANTITY. Out-of-range rows are skipped, not clamped, so a bad
    -- request cannot silently create an order the customer did not ask for.
    if v_qty < 1 or v_qty > 100 then
      continue;
    end if;

    -- Skip a variant that does not exist rather than failing on the foreign key.
    perform 1 from public.product_variants where id = v_id_text::uuid;
    if not found then
      continue;
    end if;

    insert into public.cart_items (cart_id, variant_id, quantity)
    values (v_cart_id, v_id_text::uuid, v_qty)
    on conflict (cart_id, variant_id) do update
      set quantity = excluded.quantity;
  end loop;

  update public.carts set updated_at = now() where id = v_cart_id;
end;
$$;

comment on function public.set_cart_items(uuid, jsonb) is
  'Replaces a customer''s cart with the supplied items. Also removes dead lines.';

-- ---------------------------------------------------------------------------
-- 4. merge_cart_items(): additive
-- ---------------------------------------------------------------------------
-- Used when a signed-out device cart is merged in on sign-in. Quantities are
-- summed per variant and capped at MAX_QUANTITY. Lines the payload does not
-- mention are left alone, INCLUDING dead lines.

create function public.merge_cart_items(
  p_user_id uuid,
  p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cart_id uuid;
  v_row record;
  v_id_text text;
  v_qty_text text;
  v_qty integer;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  insert into public.carts (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  select id into v_cart_id
  from public.carts
  where user_id = p_user_id;

  for v_row in
    select e.value as item
    from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) as e(value)
  loop
    v_id_text := lower(v_row.item ->> 'variantId');
    v_qty_text := v_row.item ->> 'quantity';

    if v_id_text is null
       or v_id_text !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then
      continue;
    end if;

    if v_qty_text is null or v_qty_text !~ '^[0-9]+$' then
      continue;
    end if;

    v_qty := v_qty_text::integer;

    if v_qty < 1 or v_qty > 100 then
      continue;
    end if;

    perform 1 from public.product_variants where id = v_id_text::uuid;
    if not found then
      continue;
    end if;

    -- Sum against the stored quantity, capped. A dead line has a null
    -- variant_id, so it can never match this conflict target and is untouched.
    insert into public.cart_items (cart_id, variant_id, quantity)
    values (v_cart_id, v_id_text::uuid, v_qty)
    on conflict (cart_id, variant_id) do update
      set quantity = least(public.cart_items.quantity + excluded.quantity, 100);
  end loop;

  update public.carts set updated_at = now() where id = v_cart_id;
end;
$$;

comment on function public.merge_cart_items(uuid, jsonb) is
  'Adds quantities to a customer''s cart, capped per line. Leaves dead lines alone.';

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
-- Only the service role (server code) may read or write carts.

revoke execute on function public.set_cart_items(uuid, jsonb) from public;
revoke execute on function public.merge_cart_items(uuid, jsonb) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.set_cart_items(uuid, jsonb) from anon';
    execute 'revoke execute on function public.merge_cart_items(uuid, jsonb) from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.set_cart_items(uuid, jsonb) from authenticated';
    execute 'revoke execute on function public.merge_cart_items(uuid, jsonb) from authenticated';
  end if;
end;
$$;
