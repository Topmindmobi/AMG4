-- Supplier reports (src/app/supplier/reports/page.tsx) needs order data to
-- compute sales, but orders/order_items RLS only ever allowed
-- `auth.uid() = user_id or is_admin()` — suppliers have zero read access to
-- either table, even for orders containing their own products. Granting
-- broad SELECT would leak every other customer's PII (name, phone, address)
-- to every supplier, so this is a security-definer RPC returning only the
-- minimal fields buildSupplierReport() (src/lib/reports.ts) actually reads:
-- order-level created_at/status, and per-item product_id/name_snapshot/
-- qty/price_kes — confirmed by reading that function in full before writing
-- this. No customer PII field is ever selected.
--
-- The caller's supplier_id is looked up server-side from their own profile
-- row, never accepted as a parameter, so one supplier can never request
-- another's data by passing a different id.

create or replace function public.get_supplier_sales_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_result jsonb;
begin
  select supplier_id into v_supplier_id
  from public.profiles
  where id = auth.uid() and role = 'supplier';

  if v_supplier_id is null then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(order_row), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'created_at', o.created_at,
      'status', o.status,
      'items', (
        select jsonb_agg(jsonb_build_object(
          'product_id', oi.product_id,
          'name_snapshot', oi.name_snapshot,
          'qty', oi.qty,
          'price_kes', oi.price_kes,
          'supplier_id', oi.supplier_id
        ))
        from public.order_items oi
        where oi.order_id = o.id and oi.supplier_id = v_supplier_id
      )
    ) as order_row
    from public.orders o
    where exists (
      select 1 from public.order_items oi
      where oi.order_id = o.id and oi.supplier_id = v_supplier_id
    )
  ) sub;

  return v_result;
end;
$$;

revoke all on function public.get_supplier_sales_data() from public;
grant execute on function public.get_supplier_sales_data() to authenticated;
