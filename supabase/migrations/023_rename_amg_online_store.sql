-- Rebrand: "AMG Stores" -> "AMG Online Store" in every user-facing string
-- baked into a SECURITY DEFINER function body. Per this codebase's own
-- established pattern (013 did the same "AMG.COM" -> "AMG Stores" rebrand
-- this same way over 008's mark_order_delivered), never edit an
-- already-written migration in place — re-create each function here with
-- only its notification copy changed. No schema/behavior change otherwise;
-- every clause below is byte-identical to the current live version of each
-- function.
--
-- Three functions currently contain "AMG Stores" in their live (i.e. most
-- recently create-or-replace'd) definition:
--   - public.mark_order_delivered      (last defined in 013_amg_stores_branding.sql)
--   - public.set_rider_delivery_status (last defined in 016_admin_deliver_override.sql)
--   - public.admin_assign_supplier_to_order (last defined in 020_supplier_workflow_production.sql)
-- (008's and 014's own copies of the first two are superseded/dead — not
-- touched, same as 013's own comment already explains for 008's original
-- "AMG.COM" copy.)

create or replace function public.mark_order_delivered(p_order_id uuid, p_payout_kes numeric default 150)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_payout public.rider_payouts%rowtype;
  v_rider_user_id uuid;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not (public.is_admin() or public.is_rider_of(v_order.rider_id)) then
    raise exception 'Not authorized to deliver this order';
  end if;

  update public.orders
    set status = 'delivered', delivered_at = coalesce(delivered_at, now())
    where id = p_order_id
    returning * into v_order;

  if v_order.rider_id is not null then
    insert into public.rider_payouts (order_id, rider_id, rider_name, amount_kes)
    values (p_order_id, v_order.rider_id, coalesce(v_order.rider_name_snapshot, 'Rider'), p_payout_kes)
    on conflict (order_id) do nothing
    returning * into v_payout;

    select id into v_rider_user_id
    from public.profiles
    where role = 'rider' and rider_id = v_order.rider_id
    limit 1;

    if v_rider_user_id is not null then
      insert into public.notifications (user_id, title, body, link, order_id)
      values (
        v_rider_user_id,
        'Delivery payment sent',
        format('Payment of KES %s sent for order %s.', p_payout_kes, left(p_order_id::text, 8)),
        '/rider',
        p_order_id
      );
    end if;
  end if;

  if v_order.user_id is not null then
    insert into public.notifications (user_id, title, body, link, order_id)
    values (
      v_order.user_id,
      'Your AMG Online Store order was delivered',
      format('Order %s has been delivered. Asante for shopping with AMG Online Store!', left(p_order_id::text, 8)),
      format('/order/%s', p_order_id),
      p_order_id
    );
  end if;

  return jsonb_build_object(
    'order', to_jsonb(v_order),
    'payout', to_jsonb(v_payout)
  );
end;
$$;

revoke all on function public.mark_order_delivered(uuid, numeric) from public;
grant execute on function public.mark_order_delivered(uuid, numeric) to authenticated;

create or replace function public.set_rider_delivery_status(
  p_order_id uuid,
  p_to text,
  p_fail_reason text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_current text;
  v_forward text[];
  v_now timestamptz := now();
  v_event jsonb;
  v_payout_kes numeric := 150;
  v_is_admin boolean;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  v_is_admin := public.is_admin();
  if not (v_is_admin or public.is_rider_of(v_order.rider_id)) then
    raise exception 'Not authorized to update this order';
  end if;

  if v_order.rider_id is null then
    raise exception 'Order is not assigned to a rider';
  end if;

  if p_to not in ('assigned', 'collected', 'in_transit', 'delivered', 'paid', 'failed') then
    raise exception 'Invalid stage: %', p_to;
  end if;

  -- Same fallback demo mode uses for orders predating this column.
  v_current := coalesce(
    v_order.rider_delivery_status,
    case
      when v_order.status = 'delivered' and v_order.paid then 'paid'
      when v_order.status = 'delivered' then 'delivered'
      else 'assigned'
    end
  );

  if v_current = p_to and p_to <> 'failed' then
    return v_order;
  end if;

  v_forward := case v_current
    when 'assigned' then array['collected', 'failed']
    when 'collected' then array['in_transit', 'failed']
    when 'in_transit' then array['delivered', 'failed']
    when 'delivered' then array['paid', 'failed']
    when 'failed' then array['assigned', 'collected']
    else array[]::text[]
  end;
  if not (p_to = any(v_forward))
    and not (v_is_admin and p_to in ('delivered', 'paid'))
  then
    raise exception 'Cannot move from % to %', v_current, p_to;
  end if;

  if p_to = 'paid' and not v_order.paid then
    raise exception 'Collect M-Pesa or cash before moving to Paid';
  end if;

  v_event := jsonb_build_object(
    'status', p_to,
    'at', v_now,
    'note', case
      when p_to = 'failed' then coalesce(nullif(trim(p_fail_reason), ''), 'Delivery failed')
      when p_to = 'assigned' then 'Assigned to ' || coalesce(v_order.rider_name_snapshot, 'rider')
      when v_is_admin and not (p_to = any(v_forward)) then 'Marked ' || p_to || ' by AMG admin'
      else null
    end
  );

  update public.orders
    set rider_delivery_status = p_to,
      rider_fail_reason = case when p_to = 'failed'
        then coalesce(nullif(trim(p_fail_reason), ''), 'Delivery failed')
        else null
      end,
      rider_delivery_events = coalesce(rider_delivery_events, '[]'::jsonb) || jsonb_build_array(v_event),
      status = (case when p_to in ('delivered', 'paid') then 'delivered' else 'out_for_delivery' end)::public.order_status,
      delivered_at = case
        when p_to in ('delivered', 'paid') then coalesce(delivered_at, v_now)
        when p_to = 'failed' then delivered_at
        else null
      end
    where id = p_order_id
    returning * into v_order;

  if p_to = 'paid' then
    insert into public.rider_payouts (order_id, rider_id, rider_name, amount_kes)
    values (p_order_id, v_order.rider_id, coalesce(v_order.rider_name_snapshot, 'Rider'), v_payout_kes)
    on conflict (order_id) do nothing;

    if v_order.user_id is not null then
      insert into public.notifications (user_id, title, body, link, order_id)
      values (
        v_order.user_id,
        'Payment received — delivery complete',
        format('Payment for order %s is registered. Thank you for shopping with AMG Online Store.', left(p_order_id::text, 8)),
        format('/order/%s', p_order_id),
        p_order_id
      );
    end if;
  elsif p_to = 'delivered' and v_order.user_id is not null then
    insert into public.notifications (user_id, title, body, link, order_id)
    values (
      v_order.user_id,
      'Order delivered',
      format('Your order %s has been handed over. Complete payment with the rider if still unpaid.', left(p_order_id::text, 8)),
      format('/order/%s', p_order_id),
      p_order_id
    );
  end if;

  return v_order;
end;
$$;

revoke all on function public.set_rider_delivery_status(uuid, text, text) from public;
grant execute on function public.set_rider_delivery_status(uuid, text, text) to authenticated;

create or replace function public.admin_assign_supplier_to_order(
  p_order_id uuid,
  p_supplier_id uuid,
  p_lines jsonb
)
returns public.supply_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_supplier_name text;
  v_line jsonb;
  v_order_item_id uuid;
  v_product_id uuid;
  v_qty int;
  v_price numeric(12, 2);
  v_name text;
  v_total numeric(12, 2) := 0;
  v_items jsonb := '[]'::jsonb;
  v_subtotal numeric(12, 2);
  v_result public.supply_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status not in ('pending', 'awaiting_supplier', 'supplier_confirmed') then
    raise exception 'Order is no longer open for sourcing';
  end if;

  select name into v_supplier_name from public.suppliers where id = p_supplier_id;
  if v_supplier_name is null then
    raise exception 'Supplier not found';
  end if;

  -- Idempotent: a supply_request already exists for this order+supplier
  -- pair (unique constraint from 004) — return it rather than erroring or
  -- silently re-writing order_items a second time.
  select * into v_result from public.supply_requests
    where order_id = p_order_id and supplier_id = p_supplier_id;
  if found then
    return v_result;
  end if;

  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'At least one item is required';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_order_item_id := nullif(v_line->>'order_item_id', '')::uuid;
    v_product_id := nullif(v_line->>'product_id', '')::uuid;
    v_qty := coalesce((v_line->>'qty')::int, 0);
    v_price := coalesce((v_line->>'price_kes')::numeric, -1);
    v_name := coalesce(v_line->>'name', '');

    if v_order_item_id is null or v_product_id is null or v_qty <= 0
       or v_price < 0 or v_name = '' then
      raise exception 'Invalid line item';
    end if;

    if not exists (
      select 1 from public.order_items where id = v_order_item_id and order_id = p_order_id
    ) then
      raise exception 'Order item % does not belong to this order', v_order_item_id;
    end if;

    if not exists (select 1 from public.products where id = v_product_id) then
      raise exception 'Product % not found', v_product_id;
    end if;

    update public.order_items
      set product_id = v_product_id,
          name_snapshot = v_name,
          price_kes = v_price,
          supplier_id = p_supplier_id,
          supplier_name_snapshot = v_supplier_name
      where id = v_order_item_id;

    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'order_item_id', v_order_item_id,
      'product_id', v_product_id,
      'name', v_name,
      'qty', v_qty,
      'price_kes', v_price
    ));
    v_total := v_total + (v_price * v_qty);
  end loop;

  -- Recompute the order's totals from its (possibly just-reassigned) items.
  -- discount_kes is untouched here (set only at pay-now-discount time in
  -- confirm-order-payment) — same as demo's fulfillOrderWithSupplier, which
  -- only recomputes discount_kes for already-paid orders; that one case is
  -- rare enough (reassigning supplier on an order already paid online) that
  -- getting subtotal_kes/total_kes right server-side here, and leaving any
  -- stale discount_kes for admin reconciliation, is the conservative call.
  select coalesce(sum(price_kes * qty), 0) into v_subtotal
    from public.order_items where order_id = p_order_id;

  update public.orders
    set subtotal_kes = v_subtotal,
        total_kes = v_subtotal - discount_kes,
        status = case when status = 'pending' then 'awaiting_supplier'::public.order_status else status end
    where id = p_order_id;

  insert into public.supply_requests (
    order_id, supplier_id, supplier_name, status, items, total_kes, customer_town, delivery_note
  ) values (
    p_order_id, p_supplier_id, v_supplier_name, 'pending', v_items, v_total, v_order.town,
    format(
      'Supply to AMG Online Store client in %s. Selected via value-for-money analysis. AMG will handle final dispatch.',
      v_order.town
    )
  )
  on conflict (order_id, supplier_id) do nothing
  returning * into v_result;

  if v_result.id is null then
    select * into v_result from public.supply_requests
      where order_id = p_order_id and supplier_id = p_supplier_id;
  end if;

  insert into public.notifications (user_id, title, body, link, order_id, supply_request_id)
  select p.id,
    'New supply request from AMG Online Store',
    format('Please supply items for AMG''s client in %s. Total KES %s.', v_order.town, v_total),
    format('/supplier/requests/%s', v_result.id),
    p_order_id, v_result.id
  from public.profiles p
  where p.role = 'supplier' and p.supplier_id = p_supplier_id;

  return v_result;
end;
$$;

revoke all on function public.admin_assign_supplier_to_order(uuid, uuid, jsonb) from public;
grant execute on function public.admin_assign_supplier_to_order(uuid, uuid, jsonb) to authenticated;
