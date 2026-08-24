-- Production backing for the FULL supplier order-routing workflow.
--
-- 015_admin_order_status_production.sql already added admin_request_supplier /
-- admin_record_supplier_response for the simpler /admin/order-status kanban,
-- but explicitly left two things unfinished (see its own header comment):
--   1. /admin/orders' "Compare & order" flow (confirmSupplierOrder in
--      src/app/admin/orders/page.tsx) does real supplier/product matching
--      client-side (src/lib/supplier-selection.ts) and, in demo mode,
--      REASSIGNS order_items to the chosen supplier's matched products
--      (fulfillOrderWithSupplier in demo-store.ts) — admin_request_supplier
--      never did that, it only ever snapshotted name/qty into supply_requests
--      and left order_items untouched.
--   2. /supplier/requests (SupplyKanban) — where a supplier actually
--      confirms (files a logistics plan) or dispatches (files driver/vehicle
--      details) their own supply_requests row — was 100% demo-store-only,
--      unconditionally, with no isDemoMode() branch at all. supply_requests
--      never had the logistics/dispatch/dispatched_at/fulfilled_at/
--      fulfilled_by columns or 'dispatched'/'fulfilled' status values this
--      needs; its check constraint only ever allowed
--      'pending'/'confirmed'/'rejected' (004_supplier_workflow.sql).
--
-- This migration adds the missing columns/status values and four new
-- security-definer RPCs that mirror the demo-store functions of the same
-- shape: admin_assign_supplier_to_order (mirrors fulfillOrderWithSupplier),
-- supplier_confirm_supply_request (mirrors confirmDemoSupplyRequest),
-- supplier_dispatch_supply_request (mirrors dispatchDemoSupplyRequest),
-- admin_fulfill_supply_request (mirrors fulfillDemoSupplyRequest), plus
-- supplier_reject_supply_request for parity with the existing "Suppliers
-- confirm own supply requests" UPDATE policy and the 'rejected' status the
-- table already allowed (no UI currently drives it — see summary doc).
--
-- admin_request_supplier / admin_record_supplier_response (015) are left
-- completely untouched: /admin/order-status still uses them for its own,
-- simpler flow, and nothing here depends on them.

-- ---------------------------------------------------------------------
-- Schema: bring supply_requests up to the full SupplyRequest shape used
-- throughout the frontend (src/lib/types.ts) and demo-store.ts.
-- ---------------------------------------------------------------------

alter table public.supply_requests
  add column if not exists logistics jsonb,
  add column if not exists dispatch jsonb,
  add column if not exists dispatched_at timestamptz,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists fulfilled_by uuid references public.profiles (id) on delete set null;

alter table public.supply_requests drop constraint if exists supply_requests_status_check;
alter table public.supply_requests
  add constraint supply_requests_status_check
  check (status in ('pending', 'confirmed', 'dispatched', 'fulfilled', 'rejected'));

-- ---------------------------------------------------------------------
-- Admin: assign a supplier to (some or all of) an order's lines after the
-- value-for-money comparison in the UI, reassigning order_items to the
-- chosen supplier's matched products and filing the supply_requests row.
--
-- The token-overlap product-matching heuristic (matchSupplierProduct in
-- supplier-selection.ts, including its synthetic "rival quote" product
-- construction) is display/decision logic that already runs client-side to
-- render the comparison dialog — reimplementing it in plpgsql would be a
-- second, divergent copy of the same non-trivial algorithm. Instead this
-- RPC takes the ALREADY-COMPUTED matched lines (order_item_id, product_id,
-- name, qty, price_kes) the client is already showing the admin in that
-- dialog, and treats admin authorization + row ownership as the trust
-- boundary: every order_item_id is verified to belong to p_order_id and
-- every product_id is verified to be a real row in products before either
-- is written, so a tampered payload can at worst misprice/misassign the
-- admin's OWN order, never touch another order or forge a nonexistent
-- product. This mirrors how place_order() (019) already trusts admin/
-- server-computed inputs after equivalent integrity checks.
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
      'Supply to AMG Stores client in %s. Selected via value-for-money analysis. AMG will handle final dispatch.',
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
    'New supply request from AMG Stores',
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

-- ---------------------------------------------------------------------
-- Supplier: confirm they will supply, filing the inbound logistics plan.
-- Mirrors confirmDemoSupplyRequest exactly, including allowing a
-- 'rejected' request to be re-confirmed.
-- ---------------------------------------------------------------------
create or replace function public.supplier_confirm_supply_request(
  p_request_id uuid,
  p_logistics jsonb
)
returns public.supply_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.supply_requests%rowtype;
  v_method text;
  v_location_id text;
  v_dispatch_at text;
  v_was_pending boolean;
  v_order public.orders%rowtype;
  v_all_agreed boolean;
begin
  select * into v_req from public.supply_requests where id = p_request_id for update;
  if not found then
    raise exception 'Supply request not found';
  end if;

  if not (public.is_admin() or public.is_supplier_of(v_req.supplier_id)) then
    raise exception 'Not authorized for this supply request';
  end if;

  if v_req.status in ('dispatched', 'fulfilled') then
    raise exception 'This request can no longer be confirmed';
  end if;

  v_method := p_logistics->>'method';
  v_location_id := p_logistics->>'amg_location_id';
  v_dispatch_at := p_logistics->>'planned_dispatch_at';
  if coalesce(v_method, '') = '' or coalesce(v_location_id, '') = ''
     or coalesce(v_dispatch_at, '') = '' then
    raise exception 'Logistics plan is incomplete';
  end if;
  -- Raises if unparsable, matching the demo's Number.isNaN(Date.parse(...)) guard.
  perform v_dispatch_at::timestamptz;

  v_was_pending := v_req.status in ('pending', 'rejected');

  update public.supply_requests
    set status = 'confirmed',
        confirmed_at = coalesce(confirmed_at, now()),
        logistics = p_logistics
    where id = p_request_id
    returning * into v_req;

  if v_was_pending then
    select * into v_order from public.orders where id = v_req.order_id for update;

    select not exists (
      select 1 from public.order_items oi
      where oi.order_id = v_req.order_id
        and oi.supplier_id is not null
        and not exists (
          select 1 from public.supply_requests sr
          where sr.order_id = v_req.order_id
            and sr.supplier_id = oi.supplier_id
            and sr.status in ('confirmed', 'dispatched', 'fulfilled')
        )
    ) into v_all_agreed;

    if v_all_agreed and v_order.status in ('pending', 'awaiting_supplier') then
      update public.orders set status = 'supplier_confirmed'::public.order_status where id = v_order.id;
    end if;

    insert into public.notifications (user_id, title, body, link, order_id, supply_request_id)
    select p.id,
      format('%s confirmed supply', v_req.supplier_name),
      format(
        'Order %s: logistics plan set — %s to %s.',
        left(v_req.order_id::text, 8), v_method, p_logistics->>'amg_location_name'
      ),
      '/admin/orders',
      v_req.order_id, v_req.id
    from public.profiles p where p.role = 'admin';
  end if;

  return v_req;
end;
$$;

revoke all on function public.supplier_confirm_supply_request(uuid, jsonb) from public;
grant execute on function public.supplier_confirm_supply_request(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Supplier: mark stock dispatched toward the AMG hub with driver/vehicle
-- details. Mirrors dispatchDemoSupplyRequest exactly.
-- ---------------------------------------------------------------------
create or replace function public.supplier_dispatch_supply_request(
  p_request_id uuid,
  p_dispatch jsonb
)
returns public.supply_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.supply_requests%rowtype;
  v_driver_name text;
  v_driver_phone text;
  v_plate text;
  v_vehicle_type text;
begin
  select * into v_req from public.supply_requests where id = p_request_id for update;
  if not found then
    raise exception 'Supply request not found';
  end if;

  if not (public.is_admin() or public.is_supplier_of(v_req.supplier_id)) then
    raise exception 'Not authorized for this supply request';
  end if;

  if v_req.status <> 'confirmed' then
    raise exception 'Only confirmed orders can be marked dispatched';
  end if;
  if v_req.logistics is null then
    raise exception 'Logistics plan missing — add it before dispatching';
  end if;

  v_driver_name := trim(coalesce(p_dispatch->>'driver_name', ''));
  v_driver_phone := trim(coalesce(p_dispatch->>'driver_phone', ''));
  v_plate := trim(coalesce(p_dispatch->>'vehicle_plate', ''));
  v_vehicle_type := p_dispatch->>'vehicle_type';
  if v_driver_name = '' or v_driver_phone = '' or v_plate = '' or coalesce(v_vehicle_type, '') = '' then
    raise exception 'Driver name, phone, and vehicle plate are required';
  end if;

  update public.supply_requests
    set status = 'dispatched',
        dispatch = jsonb_build_object(
          'vehicle_type', v_vehicle_type,
          'driver_name', v_driver_name,
          'driver_phone', v_driver_phone,
          'vehicle_plate', upper(v_plate),
          'vehicle_description', nullif(trim(coalesce(p_dispatch->>'vehicle_description', '')), '')
        ),
        dispatched_at = now()
    where id = p_request_id
    returning * into v_req;

  insert into public.notifications (user_id, title, body, link, order_id, supply_request_id)
  select p.id,
    format('%s dispatched to AMG', v_req.supplier_name),
    format(
      'Order %s: %s %s, driver %s (%s).',
      left(v_req.order_id::text, 8), upper(v_vehicle_type), upper(v_plate), v_driver_name, v_driver_phone
    ),
    '/admin/orders',
    v_req.order_id, v_req.id
  from public.profiles p where p.role = 'admin';

  return v_req;
end;
$$;

revoke all on function public.supplier_dispatch_supply_request(uuid, jsonb) from public;
grant execute on function public.supplier_dispatch_supply_request(uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Admin only: certify inbound goods fulfilled after physical inspection.
-- Mirrors fulfillDemoSupplyRequest.
-- ---------------------------------------------------------------------
create or replace function public.admin_fulfill_supply_request(p_request_id uuid)
returns public.supply_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.supply_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_req from public.supply_requests where id = p_request_id for update;
  if not found then
    raise exception 'Supply request not found';
  end if;
  if v_req.status <> 'dispatched' then
    raise exception 'Only dispatched supply can be certified fulfilled';
  end if;

  update public.supply_requests
    set status = 'fulfilled',
        fulfilled_at = now(),
        fulfilled_by = auth.uid()
    where id = p_request_id
    returning * into v_req;

  insert into public.notifications (user_id, title, body, link, order_id, supply_request_id)
  select p.id,
    'AMG certified your delivery',
    format('Supply for order %s was inspected and marked fulfilled.', left(v_req.order_id::text, 8)),
    format('/supplier/requests/%s', v_req.id),
    v_req.order_id, v_req.id
  from public.profiles p where p.role = 'supplier' and p.supplier_id = v_req.supplier_id;

  return v_req;
end;
$$;

revoke all on function public.admin_fulfill_supply_request(uuid) from public;
grant execute on function public.admin_fulfill_supply_request(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Supplier (or admin): decline a supply request. No UI currently drives
-- this (SupplyKanban has no "reject" action, and neither did demo-store's
-- kanban path — advanceDemoSupplyRequest only ever handles
-- confirmed/dispatched/fulfilled), but the 'rejected' status already
-- existed in the original check constraint and the "Suppliers confirm own
-- supply requests" UPDATE policy already permits a supplier to set it.
-- Added here for parity/completeness per the task's explicit "confirming
-- or rejecting" requirement, as a judgment call documented in the summary
-- rather than left as a dead status with no RPC path at all.
-- ---------------------------------------------------------------------
create or replace function public.supplier_reject_supply_request(
  p_request_id uuid,
  p_reason text default null
)
returns public.supply_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.supply_requests%rowtype;
begin
  select * into v_req from public.supply_requests where id = p_request_id for update;
  if not found then
    raise exception 'Supply request not found';
  end if;
  if not (public.is_admin() or public.is_supplier_of(v_req.supplier_id)) then
    raise exception 'Not authorized for this supply request';
  end if;
  if v_req.status not in ('pending', 'confirmed') then
    raise exception 'This request can no longer be rejected';
  end if;

  update public.supply_requests
    set status = 'rejected'
    where id = p_request_id
    returning * into v_req;

  insert into public.notifications (user_id, title, body, link, order_id, supply_request_id)
  select p.id,
    format('%s declined this supply request', v_req.supplier_name),
    coalesce(nullif(trim(p_reason), ''), 'No reason given.'),
    '/admin/orders',
    v_req.order_id, v_req.id
  from public.profiles p where p.role = 'admin';

  return v_req;
end;
$$;

revoke all on function public.supplier_reject_supply_request(uuid, text) from public;
grant execute on function public.supplier_reject_supply_request(uuid, text) to authenticated;
