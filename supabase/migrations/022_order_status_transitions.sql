-- src/app/admin/orders/page.tsx's general order-status <select> (setStatus)
-- let an admin jump an order to ANY of the 7 public.order_status values with
-- zero validation, via a raw `.from("orders").update({status})` — no
-- forward-only transition map, no admin-override distinction, unlike the
-- well-built set_rider_delivery_status (014/016), which has both.
--
-- This adds set_order_status(), the same-shaped RPC for the general order
-- pipeline: pending -> awaiting_supplier -> supplier_confirmed -> confirmed
-- -> out_for_delivery -> delivered, with cancelled reachable from any
-- non-terminal stage, and delivered/cancelled as terminal. A p_force flag
-- gives admin a narrow override — same spirit as 016's rider-kanban
-- bypass — but only to skip AHEAD or force-cancel (confirmed,
-- out_for_delivery, delivered, cancelled); forcing an order BACKWARD into
-- an earlier sourcing stage (pending/awaiting_supplier/supplier_confirmed)
-- is never allowed even with the override, since there's no real-world
-- scenario where goods already confirmed/dispatched should un-become
-- "awaiting supplier" — that would silently detach it from whatever
-- supply_requests / order_items state already reflects the later stage.
create or replace function public.set_order_status(
  p_order_id uuid,
  p_to text,
  p_force boolean default false
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
  v_force_allowed text[] := array['confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  if p_to not in (
    'pending', 'awaiting_supplier', 'supplier_confirmed', 'confirmed',
    'out_for_delivery', 'delivered', 'cancelled'
  ) then
    raise exception 'Invalid status: %', p_to;
  end if;

  v_current := v_order.status::text;
  if v_current = p_to then
    return v_order;
  end if;

  v_forward := case v_current
    when 'pending' then array['awaiting_supplier', 'confirmed', 'cancelled']
    when 'awaiting_supplier' then array['supplier_confirmed', 'confirmed', 'cancelled']
    when 'supplier_confirmed' then array['confirmed', 'cancelled']
    when 'confirmed' then array['out_for_delivery', 'cancelled']
    when 'out_for_delivery' then array['delivered', 'cancelled']
    else array[]::text[]  -- delivered, cancelled: terminal
  end;

  if not (p_to = any(v_forward)) then
    if not (p_force and p_to = any(v_force_allowed)) then
      raise exception 'Cannot move from % to %', v_current, p_to;
    end if;
  end if;

  update public.orders
    set status = p_to::public.order_status,
        buyer_notified_at = case
          when p_to = 'confirmed' then coalesce(buyer_notified_at, now())
          else buyer_notified_at
        end
    where id = p_order_id
    returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.set_order_status(uuid, text, boolean) from public;
grant execute on function public.set_order_status(uuid, text, boolean) to authenticated;
