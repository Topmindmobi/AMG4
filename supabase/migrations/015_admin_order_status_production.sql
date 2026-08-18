-- Production backing for the admin Order Status kanban.
--
-- The whole page was gated behind `if (!isDemoMode()) return;` with no
-- production branch at all — same class of bug 014 fixed for the rider
-- kanban, just never carried over here. Confirm-to-buyer and Dispatch
-- reuse the same direct table updates /admin/orders already uses in
-- production; Deliver reuses 014's set_rider_delivery_status /
-- rider_mark_order_paid RPCs (admin is already an authorized caller on
-- both). Only the supplier-sourcing steps — Request supplier / Record
-- response — touch supply_requests, which had no production path
-- anywhere, so those two get new security-definer RPCs here.
--
-- Note: this does not touch /supplier/requests, which is a separate,
-- still demo-only page (suppliers can't yet see or confirm these
-- requests in production). That's a bigger follow-up — its confirm/
-- dispatch flow needs logistics/dispatch columns supply_requests
-- doesn't have yet.

create or replace function public.admin_request_supplier(p_order_id uuid, p_supplier_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_supplier_name text;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;

  select name into v_supplier_name from public.suppliers where id = p_supplier_id;
  if v_supplier_name is null then
    raise exception 'Supplier not found';
  end if;

  insert into public.supply_requests (order_id, supplier_id, supplier_name, items, total_kes, customer_town)
  values (
    p_order_id,
    p_supplier_id,
    v_supplier_name,
    coalesce(
      (select jsonb_agg(jsonb_build_object('name', name_snapshot, 'qty', qty))
       from public.order_items where order_id = p_order_id),
      '[]'::jsonb
    ),
    v_order.total_kes,
    v_order.town
  )
  on conflict (order_id, supplier_id) do nothing;

  update public.orders
    set status = 'awaiting_supplier'::public.order_status
    where id = p_order_id and status = 'pending'::public.order_status;
end;
$$;

revoke all on function public.admin_request_supplier(uuid, uuid) from public;
grant execute on function public.admin_request_supplier(uuid, uuid) to authenticated;

-- Admin attestation that the supplier agreed (mirrors adminRecordSupplierResponse
-- in demo mode) — not a real-time read of supplier confirmation, since suppliers
-- have no production path to respond yet either.
create or replace function public.admin_record_supplier_response(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.supply_requests
    set status = 'confirmed', confirmed_at = now()
    where order_id = p_order_id and status = 'pending';

  update public.orders
    set status = 'supplier_confirmed'::public.order_status
    where id = p_order_id;
end;
$$;

revoke all on function public.admin_record_supplier_response(uuid) from public;
grant execute on function public.admin_record_supplier_response(uuid) to authenticated;
