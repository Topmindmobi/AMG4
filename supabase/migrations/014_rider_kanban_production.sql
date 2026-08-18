-- Production backing for the rider delivery kanban.
--
-- rider_delivery_status / rider_fail_reason / rider_delivery_events were
-- TypeScript-only fields on Order — demo mode had a full state machine for
-- them (see setDemoRiderDeliveryStatus / markDemoOrderPaid in
-- src/lib/store/demo-store.ts) but nothing in the real schema ever backed
-- them, so every kanban action in production hit a hardcoded
-- "requires demo mode" error. This adds the columns and the two
-- security-definer RPCs riders need: advancing a stage, and registering
-- payment collected at the door.

alter table public.orders
  add column if not exists rider_delivery_status text
    check (rider_delivery_status in ('assigned', 'collected', 'in_transit', 'delivered', 'paid', 'failed')),
  add column if not exists rider_fail_reason text,
  add column if not exists rider_delivery_events jsonb not null default '[]'::jsonb;

-- Advance (or set) the rider kanban stage. Mirrors setDemoRiderDeliveryStatus:
-- validates the forward-only transition map server-side, requires paid=true
-- before allowing the Paid column, and creates the rider payout + customer
-- notification on the same paid transition mark_order_delivered used to.
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
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not (public.is_admin() or public.is_rider_of(v_order.rider_id)) then
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
  if not (p_to = any(v_forward)) then
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
        format('Payment for order %s is registered. Thank you for shopping with AMG Stores.', left(p_order_id::text, 8)),
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

-- Register cash/M-Pesa payment collected at the door. Mirrors markDemoOrderPaid.
create or replace function public.rider_mark_order_paid(
  p_order_id uuid,
  p_method public.payment_method,
  p_mpesa_phone text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_now timestamptz := now();
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if not (public.is_admin() or public.is_rider_of(v_order.rider_id)) then
    raise exception 'Not authorized to update this order';
  end if;

  if v_order.status not in ('out_for_delivery', 'confirmed', 'delivered') then
    raise exception 'Only orders in delivery can be marked paid here';
  end if;

  if v_order.paid then
    return v_order;
  end if;

  update public.orders
    set paid = true,
      paid_at = v_now,
      payment_method = p_method,
      mpesa_phone = case when p_method = 'mpesa'
        then coalesce(p_mpesa_phone, mpesa_phone, phone)
        else mpesa_phone
      end
    where id = p_order_id
    returning * into v_order;

  if v_order.user_id is not null then
    insert into public.notifications (user_id, title, body, link, order_id)
    values (
      v_order.user_id,
      'Payment received',
      format(
        'Payment of KES %s for order %s was registered (%s).',
        v_order.total_kes,
        left(p_order_id::text, 8),
        case when p_method = 'mpesa' then 'M-Pesa' else 'cash' end
      ),
      format('/order/%s', p_order_id),
      p_order_id
    );
  end if;

  -- Goods were already handed over before payment came in (e.g. rider
  -- marks Delivered, THEN collects M-Pesa at the door) — close the trip
  -- on the Paid column right away instead of leaving it stuck on
  -- Delivered waiting for a second manual move.
  if v_order.rider_id is not null and coalesce(
    v_order.rider_delivery_status,
    case when v_order.status = 'delivered' then 'delivered' else 'assigned' end
  ) = 'delivered' then
    return public.set_rider_delivery_status(p_order_id, 'paid');
  end if;

  return v_order;
end;
$$;

revoke all on function public.rider_mark_order_paid(uuid, public.payment_method, text) from public;
grant execute on function public.rider_mark_order_paid(uuid, public.payment_method, text) to authenticated;
