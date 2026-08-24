-- Security fix: checkout pricing + order creation were entirely client
-- controlled. src/app/checkout/page.tsx built orderRow.total_kes and every
-- line item's price_kes from the browser's cart state, then
-- src/lib/offline/order-queue.ts inserted them straight into orders/
-- order_items via two separate REST calls, permitted by
-- "Anyone can create orders"/"Anyone can insert order items" (`with check
-- (true)`, 001_schema.sql) plus the anon/authenticated grants added in
-- 005_order_place_rls.sql. A client could edit the cart price in devtools
-- (or call the PostgREST endpoint directly) and place a real order at an
-- arbitrary price, with zero stock enforcement and no atomicity between the
-- order row and its items.
--
-- Fix: a single `security definer` RPC, place_order(), that:
--   - looks up each item's REAL current price_kes from products (ignores
--     any client-supplied price/name)
--   - validates requested qty against products.stock and rejects the whole
--     order if any line exceeds available stock (does NOT decrement stock —
--     see note at the end of this file)
--   - computes subtotal_kes/total_kes server-side from those real prices
--   - inserts the order + all its items in one transaction (a plpgsql
--     function body is transactional by default — a mid-way exception rolls
--     back the whole thing, fixing the previous two-REST-call non-atomicity)
--   - always inserts paid = false / paid_at = null — the client can no
--     longer assert a paid order at creation time (see
--     src/app/api/mpesa/confirm-order-payment/route.ts for how paid=true is
--     now set, using the service-role admin client from server-verified
--     M-Pesa payment confirmation, never from a client-supplied boolean)
--   - is idempotent on p_order_id, so the existing offline-queue retry
--     contract (src/lib/offline/order-queue.ts, which pre-generates the
--     order id client-side so a retried submit after a lost response is
--     safe) keeps working without relying on a 23505 duplicate-key catch.

-- Returns the full order + its line items as jsonb (same shape as
-- get_order_confirmation) but WITHOUT that function's ownership check — the
-- caller placing an order IS its creator, receiving the create call's own
-- result, which is a different trust boundary than re-reading an order
-- later by id. This also sidesteps a real ordering problem: guest
-- checkout's order.user_id is set to an account that was just silently
-- created for the buyer WITHOUT signing the browser into it (see
-- checkout/page.tsx), so auth.uid() is still null right after this call
-- returns — get_order_confirmation's ownership check
-- (018_lock_order_confirmation.sql) would correctly refuse that anonymous
-- read. Returning the created row directly here (and, on an idempotent
-- replay, re-building the same unguarded result rather than delegating to
-- get_order_confirmation) avoids needing a second, differently-authorized
-- call just to render the confirmation page immediately after checkout.
create or replace function public.place_order(
  p_customer_name text,
  p_phone text,
  p_email text,
  p_town text,
  p_address text,
  p_payment_method text,
  p_mpesa_phone text,
  p_delivery_method text,
  p_dropoff_point_id uuid,
  p_dropoff_point_name text,
  p_user_id uuid,
  p_items jsonb,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid := coalesce(p_order_id, gen_random_uuid());
  v_item jsonb;
  v_product public.products%rowtype;
  v_qty int;
  v_subtotal numeric(12, 2) := 0;
  v_already_exists boolean;
  v_existing_owner uuid;
  v_result jsonb;
begin
  -- Idempotent retry: the offline queue may replay a submission whose
  -- response was lost after the server already committed it. If this id
  -- was already placed, skip straight to building/returning the existing
  -- row instead of erroring or double-inserting.
  --
  -- p_order_id is a client-generated uuid v4 (crypto.randomUUID()) that is
  -- never transmitted anywhere before this call — unlike an order id
  -- reached via a URL (get_order_confirmation's problem, fixed in
  -- 018_lock_order_confirmation.sql: those leak via referrers/history/
  -- screenshots), this one has no prior exposure for anyone but the
  -- original caller to have learned it, so it functions as a real
  -- idempotency key (the same pattern as e.g. Stripe's Idempotency-Key).
  -- For a SIGNED-IN caller we still verify ownership on the replay path
  -- below, at near-zero cost, as defense in depth.
  select o.user_id into v_existing_owner from public.orders o where o.id = v_order_id;
  v_already_exists := found;

  if v_already_exists and auth.uid() is not null
     and not (auth.uid() = v_existing_owner or public.is_admin()) then
    raise exception 'Not authorized for this order';
  end if;

  if not v_already_exists then
    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'Order must include at least one item';
    end if;
    if p_payment_method not in ('cod', 'mpesa') then
      raise exception 'Invalid payment method: %', p_payment_method;
    end if;
    if p_delivery_method not in ('doorstep', 'dropoff') then
      raise exception 'Invalid delivery method: %', p_delivery_method;
    end if;

    -- A signed-in caller may only place orders under their own account (or
    -- as admin). An anonymous caller may pass any p_user_id: guest checkout
    -- (src/app/checkout/page.tsx) auto-creates the buyer's account via
    -- /api/auth/ensure-customer WITHOUT signing the browser into it, so
    -- auth.uid() is still null at the moment the order is placed — this is
    -- existing, intentional app behaviour (see 005_order_place_rls.sql's
    -- own comment about guest orders), not something this fix changes.
    if auth.uid() is not null and p_user_id is not null
       and p_user_id <> auth.uid() and not public.is_admin() then
      raise exception 'Cannot place an order for another user';
    end if;

    insert into public.orders (
      id, user_id, customer_name, phone, email, town, address,
      payment_method, mpesa_phone, paid, paid_at,
      subtotal_kes, discount_kes, delivery_method,
      dropoff_point_id, dropoff_point_name, status, total_kes
    ) values (
      v_order_id, p_user_id, trim(p_customer_name), trim(p_phone),
      nullif(trim(coalesce(p_email, '')), ''), p_town, trim(p_address),
      p_payment_method::public.payment_method, nullif(trim(coalesce(p_mpesa_phone, '')), ''),
      false, null,
      0, 0, p_delivery_method, p_dropoff_point_id, p_dropoff_point_name, 'pending', 0
    );

    for v_item in select * from jsonb_array_elements(p_items)
    loop
      v_qty := coalesce((v_item->>'qty')::int, 0);
      if v_qty <= 0 then
        raise exception 'Invalid quantity for item %', v_item->>'productId';
      end if;

      select * into v_product from public.products
        where id = (v_item->>'productId')::uuid;
      if not found or not v_product.is_active then
        raise exception 'Product not available: %', v_item->>'productId';
      end if;
      if v_product.stock < v_qty then
        raise exception 'Insufficient stock for "%": requested %, only % available',
          v_product.name, v_qty, v_product.stock;
      end if;

      insert into public.order_items (order_id, product_id, name_snapshot, price_kes, qty)
      values (v_order_id, v_product.id, v_product.name, v_product.price_kes, v_qty);

      v_subtotal := v_subtotal + (v_product.price_kes * v_qty);
    end loop;

    update public.orders
      set subtotal_kes = v_subtotal,
          total_kes = v_subtotal
      where id = v_order_id;
  end if;

  select jsonb_build_object(
    'id', o.id,
    'user_id', o.user_id,
    'customer_name', o.customer_name,
    'phone', o.phone,
    'email', o.email,
    'town', o.town,
    'address', o.address,
    'payment_method', o.payment_method,
    'mpesa_phone', o.mpesa_phone,
    'paid', o.paid,
    'paid_at', o.paid_at,
    'subtotal_kes', o.subtotal_kes,
    'discount_kes', o.discount_kes,
    'delivery_method', o.delivery_method,
    'dropoff_point_id', o.dropoff_point_id,
    'dropoff_point_name', o.dropoff_point_name,
    'rider_id', o.rider_id,
    'rider_name_snapshot', o.rider_name_snapshot,
    'delivered_at', o.delivered_at,
    'status', o.status,
    'total_kes', o.total_kes,
    'created_at', o.created_at,
    'buyer_notified_at', o.buyer_notified_at,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'order_id', i.order_id,
            'product_id', i.product_id,
            'name_snapshot', i.name_snapshot,
            'price_kes', i.price_kes,
            'qty', i.qty
          )
          order by i.id
        )
        from public.order_items i
        where i.order_id = o.id
      ),
      '[]'::jsonb
    )
  )
  into v_result
  from public.orders o
  where o.id = v_order_id;

  return v_result;
end;
$$;

revoke all on function public.place_order(
  text, text, text, text, text, text, text, text, uuid, text, uuid, jsonb, uuid
) from public;
grant execute on function public.place_order(
  text, text, text, text, text, text, text, text, uuid, text, uuid, jsonb, uuid
) to anon, authenticated;

-- Tighten orders/order_items INSERT so direct client-side inserts are no
-- longer possible. place_order() is `security definer`, so it executes as
-- its owner and bypasses both RLS and these grants entirely — this does not
-- affect the new RPC path, only the old raw-REST-insert path (confirmed by
-- grep: src/lib/offline/order-queue.ts was the only code inserting into
-- these tables directly, and it's updated in this same change to call the
-- RPC instead).

drop policy if exists "Anyone can create orders" on public.orders;
drop policy if exists "Anyone can insert order items" on public.order_items;

revoke insert on public.orders from anon, authenticated;
revoke insert on public.order_items from anon, authenticated;

-- Note on stock: this migration VALIDATES requested qty against
-- products.stock and rejects the order if insufficient, but deliberately
-- does NOT decrement stock on order placement. The task only asked for
-- validation ("reject or clamp"), and stock today is managed manually by
-- suppliers/admin (supabase/migrations has no existing decrement path
-- either) — auto-decrementing would change that workflow's semantics
-- without product/business sign-off. Flagged in the summary as a follow-up
-- worth a deliberate decision, not silently done here.
