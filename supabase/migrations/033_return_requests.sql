-- Returns: track-status-only (no payment gateway integration). 7-day return
-- window measured from orders.delivered_at (now reliably set for every path
-- via 031's trigger).

create table public.return_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'refunded')),
  reason text not null
    check (reason in ('damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'other')),
  reason_notes text,
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  refund_amount_kes numeric(12, 2),
  admin_notes text
);

create table public.return_request_items (
  id uuid primary key default gen_random_uuid(),
  return_request_id uuid not null references public.return_requests (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  qty int not null check (qty > 0)
);

create index return_requests_order_idx on public.return_requests (order_id);
create index return_requests_status_idx on public.return_requests (status);
create index return_request_items_request_idx on public.return_request_items (return_request_id);

-- At most one open (not yet rejected/refunded) return per order.
create unique index return_requests_one_open_idx
  on public.return_requests (order_id)
  where status in ('requested', 'approved');

alter table public.return_requests enable row level security;
alter table public.return_request_items enable row level security;

create policy "Owner or admin reads return requests"
  on public.return_requests for select
  using (user_id = auth.uid() or public.is_admin());

create policy "Owner or admin reads return request items"
  on public.return_request_items for select
  using (
    exists (
      select 1 from public.return_requests r
      where r.id = return_request_id and (r.user_id = auth.uid() or public.is_admin())
    )
  );

-- No insert/update policies — writes go through the RPCs below only,
-- same "RPC-only" shape as callback_requests (024).

create or replace function public.request_return(
  p_order_id uuid,
  p_reason text,
  p_reason_notes text,
  p_items jsonb  -- [{ "order_item_id": uuid, "qty": int }]
)
returns public.return_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_return public.return_requests%rowtype;
  v_item jsonb;
  v_max_qty int;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;
  if p_reason not in ('damaged', 'wrong_item', 'not_as_described', 'changed_mind', 'other') then
    raise exception 'Invalid reason';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.user_id is distinct from auth.uid() then
    raise exception 'Not your order';
  end if;
  if v_order.status <> 'delivered' or v_order.delivered_at is null then
    raise exception 'Order must be delivered before a return can be requested';
  end if;
  if now() > v_order.delivered_at + interval '7 days' then
    raise exception 'Return window (7 days after delivery) has closed';
  end if;
  if exists (
    select 1 from public.return_requests
    where order_id = p_order_id and status in ('requested', 'approved')
  ) then
    raise exception 'A return is already in progress for this order';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Select at least one item to return';
  end if;

  insert into public.return_requests (order_id, user_id, reason, reason_notes)
  values (p_order_id, auth.uid(), p_reason, nullif(trim(coalesce(p_reason_notes, '')), ''))
  returning * into v_return;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    select qty into v_max_qty from public.order_items
      where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id;
    if v_max_qty is null then
      raise exception 'Item % does not belong to this order', v_item->>'order_item_id';
    end if;
    if (v_item->>'qty')::int < 1 or (v_item->>'qty')::int > v_max_qty then
      raise exception 'Invalid quantity for item %', v_item->>'order_item_id';
    end if;

    insert into public.return_request_items (return_request_id, order_item_id, qty)
    values (v_return.id, (v_item->>'order_item_id')::uuid, (v_item->>'qty')::int);
  end loop;

  insert into public.notifications (user_id, title, body, link, order_id)
  select p.id,
    'New return request',
    format('%s requested a return for order %s.', v_order.customer_name, left(p_order_id::text, 8)),
    '/admin/returns',
    p_order_id
  from public.profiles p where p.role = 'admin';

  return v_return;
end;
$$;

revoke all on function public.request_return(uuid, text, text, jsonb) from public;
grant execute on function public.request_return(uuid, text, text, jsonb) to authenticated;

create or replace function public.admin_resolve_return(
  p_return_id uuid,
  p_status text,
  p_admin_notes text,
  p_refund_amount_kes numeric
)
returns public.return_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.return_requests%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if p_status not in ('approved', 'rejected', 'refunded') then
    raise exception 'Invalid status %', p_status;
  end if;

  select * into v_return from public.return_requests where id = p_return_id for update;
  if not found then
    raise exception 'Return request not found';
  end if;
  if p_status = 'refunded' and v_return.status <> 'approved' then
    raise exception 'Can only mark refunded after approval';
  end if;
  if p_status in ('approved', 'rejected') and v_return.status <> 'requested' then
    raise exception 'Return is no longer pending';
  end if;

  update public.return_requests
    set status = p_status,
        admin_notes = coalesce(nullif(trim(coalesce(p_admin_notes, '')), ''), admin_notes),
        refund_amount_kes = case when p_status = 'refunded' then p_refund_amount_kes else refund_amount_kes end,
        resolved_at = case when resolved_at is null then now() else resolved_at end,
        resolved_by = case when resolved_by is null then auth.uid() else resolved_by end
    where id = p_return_id
    returning * into v_return;

  insert into public.notifications (user_id, title, body, link, order_id)
  values (
    v_return.user_id,
    format('Return %s', p_status),
    format('Your return request for order %s was marked %s.', left(v_return.order_id::text, 8), p_status),
    format('/order/%s', v_return.order_id),
    v_return.order_id
  );

  return v_return;
end;
$$;

revoke all on function public.admin_resolve_return(uuid, text, text, numeric) from public;
grant execute on function public.admin_resolve_return(uuid, text, text, numeric) to authenticated;

-- Optional return-photo evidence — private bucket, same per-user-folder-
-- prefix + admin-read-all pattern as kyc-documents (030). Phase-2/nice-to-
-- have: ship the table/RPCs and status tracker first; wire photo upload in
-- once the base flow is verified end-to-end.
insert into storage.buckets (id, name, public)
values ('return-evidence', 'return-evidence', false)
on conflict (id) do nothing;

create policy "Users manage own return evidence"
  on storage.objects for all
  using (bucket_id = 'return-evidence' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'return-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "Admins read return evidence"
  on storage.objects for select
  using (bucket_id = 'return-evidence' and public.is_admin());
