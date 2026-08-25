-- "Order on call" feature: a customer who'd rather not check out online
-- leaves their name/phone (and an optional note on what they want) and staff
-- calls them back to take the order.
--
-- Unlike quote_requests (009_quote_requests.sql), which allows a wide-open
-- direct insert (`with check (true)`), this table has NO insert policy at
-- all — inserts only happen through the request_callback() RPC below. That
-- matches the tighter pattern the 2026-08-24 audit moved the rest of the app
-- to (place_order, the supplier RPCs) rather than repeating quote_requests'
-- older, more permissive shape. The RPC also fans out an admin notification
-- on submission, which quote_requests never did.

create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  phone text not null,
  note text,
  status text not null default 'pending' check (status in ('pending', 'contacted', 'resolved')),
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  contacted_by uuid references auth.users (id) on delete set null
);

create index if not exists callback_requests_created_idx on public.callback_requests (created_at desc);
create index if not exists callback_requests_status_idx on public.callback_requests (status);

alter table public.callback_requests enable row level security;

create policy "Admins read callback requests"
  on public.callback_requests for select
  using (public.is_admin());

create policy "Admins update callback requests"
  on public.callback_requests for update
  using (public.is_admin());

-- No grants to anon/authenticated on the table itself — every read/write
-- goes through these two security-definer functions.

create or replace function public.request_callback(
  p_customer_name text,
  p_phone text,
  p_note text,
  p_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if coalesce(trim(p_customer_name), '') = '' then
    raise exception 'Name is required';
  end if;
  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Phone number is required';
  end if;

  insert into public.callback_requests (user_id, customer_name, phone, note)
  values (p_user_id, trim(p_customer_name), trim(p_phone), nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  insert into public.notifications (user_id, title, body, link)
  select p.id,
    'New callback request',
    format('%s (%s) asked to be called back to place an order.', trim(p_customer_name), trim(p_phone)),
    '/admin/callbacks'
  from public.profiles p
  where p.role = 'admin';

  return v_id;
end;
$$;

revoke all on function public.request_callback(text, text, text, uuid) from public;
grant execute on function public.request_callback(text, text, text, uuid) to anon, authenticated;

create or replace function public.set_callback_status(
  p_id uuid,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can update callback requests';
  end if;
  if p_status not in ('pending', 'contacted', 'resolved') then
    raise exception 'Invalid status %', p_status;
  end if;

  update public.callback_requests
  set status = p_status,
      contacted_at = case
        when p_status in ('contacted', 'resolved') then coalesce(contacted_at, now())
        else contacted_at
      end,
      contacted_by = case
        when p_status in ('contacted', 'resolved') then coalesce(contacted_by, auth.uid())
        else contacted_by
      end
  where id = p_id;
end;
$$;

revoke all on function public.set_callback_status(uuid, text) from public;
grant execute on function public.set_callback_status(uuid, text) to authenticated;
