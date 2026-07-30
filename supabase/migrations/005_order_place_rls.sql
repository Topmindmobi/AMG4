-- Checkout uses insert + RETURNING (PostgREST .select() after insert).
-- Postgres requires the new row to ALSO pass SELECT policies for RETURNING.
-- Guest orders have user_id null, so "auth.uid() = user_id" fails and the
-- whole insert appears as: new row violates row-level security policy.
--
-- Fix: allow RETURNING for the inserting role without allowing anonymous
-- listing of all guest orders. We do that via a security-definer RPC that
-- returns a single order by primary key (UUID acts as an unguessable token).

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
    'town', o.town,
    'address', o.address,
    'payment_method', o.payment_method,
    'mpesa_phone', o.mpesa_phone,
    'status', o.status,
    'total_kes', o.total_kes,
    'created_at', o.created_at,
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

-- Ensure Data API roles can write orders (needed on newer Supabase projects
-- where public tables are not auto-exposed).
grant usage on schema public to anon, authenticated;
grant select, insert on public.orders to anon, authenticated;
grant select, insert on public.order_items to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.categories to anon, authenticated;
