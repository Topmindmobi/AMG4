-- Supplier and rider accounts should never place orders under their own
-- account — if they want to buy, they register a separate customer
-- account. place_order() already lets admin submit an order for someone
-- else (p_user_id <> auth.uid()) — this adds the missing check: the
-- *authenticated caller's own* role (auth.uid(), not whatever p_user_id
-- they send) can't be supplier/rider, full stop. Everything else about
-- place_order() — signature, idempotency, other checks — is unchanged.
-- `create or replace`, not an edit to 021's file, per this repo's "never
-- edit an already-written migration" convention (see 021's own header).

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
  -- row instead of erroring, double-inserting, or double-decrementing stock.
  select o.user_id into v_existing_owner from public.orders o where o.id = v_order_id;
  v_already_exists := found;

  if v_already_exists and auth.uid() is not null
     and not (auth.uid() = v_existing_owner or public.is_admin()) then
    raise exception 'Not authorized for this order';
  end if;

  if not v_already_exists then
    if exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('supplier', 'rider')
    ) then
      raise exception 'Supplier and rider accounts cannot place orders. Register a separate customer account to shop.';
    end if;

    if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
      raise exception 'Order must include at least one item';
    end if;
    if p_payment_method not in ('cod', 'mpesa') then
      raise exception 'Invalid payment method: %', p_payment_method;
    end if;
    if p_delivery_method not in ('doorstep', 'dropoff') then
      raise exception 'Invalid delivery method: %', p_delivery_method;
    end if;

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

    -- Process items in a stable order (by product id) so two concurrent
    -- orders touching the same set of products always take their row locks
    -- in the same order — avoiding a classic lock-ordering deadlock between
    -- two multi-item checkouts that overlap on more than one product.
    for v_item in
      select value from jsonb_array_elements(p_items) as value
      order by (value->>'productId')
    loop
      v_qty := coalesce((v_item->>'qty')::int, 0);
      if v_qty <= 0 then
        raise exception 'Invalid quantity for item %', v_item->>'productId';
      end if;

      -- Row-lock the product BEFORE checking stock: this is what closes the
      -- race two concurrent checkouts could previously win simultaneously
      -- against the same last few units. The second transaction blocks here
      -- until the first either commits its decrement or rolls back, then
      -- re-reads genuinely current stock rather than a stale snapshot.
      select * into v_product from public.products
        where id = (v_item->>'productId')::uuid
        for update;
      if not found or not v_product.is_active then
        raise exception 'Product not available: %', v_item->>'productId';
      end if;
      if v_product.stock < v_qty then
        raise exception 'Insufficient stock for "%": requested %, only % available',
          v_product.name, v_qty, v_product.stock;
      end if;

      update public.products
        set stock = stock - v_qty
        where id = v_product.id;

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

-- Signature is unchanged, so the existing grants already apply; re-stating
-- them here is harmless and keeps this migration self-contained.
revoke all on function public.place_order(
  text, text, text, text, text, text, text, text, uuid, text, uuid, jsonb, uuid
) from public;
grant execute on function public.place_order(
  text, text, text, text, text, text, text, text, uuid, text, uuid, jsonb, uuid
) to anon, authenticated;
