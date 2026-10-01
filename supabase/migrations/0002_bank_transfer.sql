-- 0002_bank_transfer.sql
--
-- Adds "bank_transfer" as a second payment method.
--
-- This is the minimum schema change needed to persist the choice:
--   1. widens the orders.payment_method check constraint to allow both methods
--   2. replaces create_order() with a version that accepts the chosen method
--
-- Payment status is deliberately untouched. A bank-transfer order is created
-- "unpaid" like any other order and stays unpaid until an admin verifies the
-- transfer manually. Nothing here marks a transfer as received: there is no
-- automatic bank reconciliation in this pass (AGENTS.md section 27).

-- ---------------------------------------------------------------------------
-- 1. Widen the constraint
-- ---------------------------------------------------------------------------
-- Written to be re-runnable: the constraint is dropped only if present, so
-- pushing this twice cannot fail on an existing constraint.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_payment_method_check'
  ) then
    alter table public.orders drop constraint orders_payment_method_check;
  end if;
end;
$$;

alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('pay_on_delivery', 'bank_transfer'));

-- ---------------------------------------------------------------------------
-- 2. Replace create_order() with a version that takes the payment method
-- ---------------------------------------------------------------------------
-- CREATE OR REPLACE cannot change a function's parameter list: given a different
-- signature it creates an OVERLOAD instead, which leaves two functions with the
-- same name and makes every bare `create_order` reference ambiguous. The old
-- signature is therefore dropped first.
--
-- The new parameter is appended last and defaults to 'pay_on_delivery', so the
-- function stays callable exactly as before.

drop function if exists public.create_order(
  uuid, text, text, text, text, text, text, integer, integer, integer, uuid,
  jsonb
);

create function public.create_order(
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
  p_items jsonb,
  p_payment_method text default 'pay_on_delivery'
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_item jsonb;
  v_payment_method text;
begin
  -- The browser is not trusted with this value. The server validated it against
  -- the shared enum already; the database narrows it again rather than storing
  -- whatever arrived.
  v_payment_method := case
    when p_payment_method = 'bank_transfer' then 'bank_transfer'
    else 'pay_on_delivery'
  end;

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
    total,
    payment_method
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
    p_total,
    v_payment_method
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

-- Every statement that names the function must give its full argument list,
-- otherwise Postgres cannot tell the signatures apart.
comment on function public.create_order(
  uuid, text, text, text, text, text, text, integer, integer, integer, uuid,
  jsonb, text
) is
  'Atomically creates an order and its items. Call with server-validated values only.';

-- Only the service role (server code) may create orders.
revoke execute on function public.create_order(
  uuid, text, text, text, text, text, text, integer, integer, integer, uuid,
  jsonb, text
) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.create_order(uuid, text, text, text, text, text, text, integer, integer, integer, uuid, jsonb, text) from anon';
  end if;

  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke execute on function public.create_order(uuid, text, text, text, text, text, text, integer, integer, integer, uuid, jsonb, text) from authenticated';
  end if;
end;
$$;