-- Rebrand: "AMG.COM" -> "AMG Stores" in the delivered-order notification text
-- baked into mark_order_delivered() by 008_rider_payouts.sql. Re-creates the
-- same function with only that copy changed.

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
      'Your AMG Stores order was delivered',
      format('Order %s has been delivered. Asante for shopping with AMG Stores!', left(p_order_id::text, 8)),
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
