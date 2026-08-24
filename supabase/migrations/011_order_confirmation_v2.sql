-- Extend get_order_confirmation() (from 005_order_place_rls.sql) with the
-- payment/discount/delivery fields added in 007, so the guest confirmation
-- and tracking pages show accurate info in Supabase (production) mode too.

create or replace function public.get_order_confirmation(p_order_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
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
