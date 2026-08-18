-- Fix: admin's "Deliver" override in the Order Status kanban calls
-- set_rider_delivery_status(orderId, 'delivered') directly, but 014's
-- forward-only transition map (assigned -> collected -> in_transit ->
-- delivered -> paid) rejects that as a skipped stage — caught live
-- against production: "Cannot move from assigned to delivered".
--
-- Demo mode's setDemoRiderDeliveryStatus has no such check at all (it's
-- an unconditional admin override), so 014's stricter validation was a
-- real improvement for the rider's own kanban, not something to remove —
-- it just needs to not apply when an admin is force-closing an order
-- from a stage the rider's app never advanced past (phone issue, forgot
-- to update, order dispatched outside the normal flow, etc). Riders
-- still only get the strict next-stage transitions; only admin gets the
-- 'delivered'/'paid' bypass.

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
