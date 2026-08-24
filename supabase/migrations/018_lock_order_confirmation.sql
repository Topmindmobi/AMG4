-- Security fix: get_order_confirmation (007_payment_delivery_riders.sql,
-- last redefined in 011_order_confirmation_v2.sql) is `security definer` and
-- granted to anon+authenticated, but had NO ownership check — it returned
-- full order PII (customer_name, phone, address, mpesa_phone, items) for ANY
-- order id, treating the UUID as an "unguessable token" instead of doing
-- real access control. Anyone who obtained an order id (referrer leak,
-- shared screenshot, browser history) could read another customer's PII.
--
-- Fix: only return data when the caller is the order's owner (auth.uid() =
-- orders.user_id) or an admin. Unauthenticated/unauthorized callers get
-- `null` back (not an exception) so the existing client fallback chain in
-- src/app/order/[id]/page.tsx (RPC -> direct table select -> sessionStorage
-- stash) degrades the same way it already does today for any other
-- RLS-denied read, instead of surfacing a hard error.
--
-- Known trade-off (see summary): guest checkout auto-creates an account for
-- the buyer but does NOT sign the browser into it, so immediately after
-- guest checkout auth.uid() is still null. Those buyers already fall back to
-- the sessionStorage-stashed order snapshot from checkout — this migration
-- doesn't change that path. What DOES change: an anonymous guest reloading
-- /order/<id> in a fresh tab (no stash, no login) will no longer be able to
-- pull live PII/paid-status updates for that order via this RPC — same as
-- the pre-existing "Users read own orders" table RLS already required for
-- direct reads. This is the intended security posture, not a regression
-- introduced beyond what RLS already enforced elsewhere.

create or replace function public.get_order_confirmation(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
  v_owner uuid;
begin
  select o.user_id into v_owner from public.orders o where o.id = p_order_id;

  if not found then
    return null;
  end if;

  if not (auth.uid() = v_owner or public.is_admin()) then
    return null;
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
  into result
  from public.orders o
  where o.id = p_order_id;

  return result;
end;
$$;

revoke all on function public.get_order_confirmation(uuid) from public;
grant execute on function public.get_order_confirmation(uuid) to anon, authenticated;
