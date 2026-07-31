-- Instant building-materials quote requests.

create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  phone text not null,
  town text not null check (town in ('Homabay', 'Mbita', 'Migori')),
  items jsonb not null default '[]',
  subtotal_kes numeric(12, 2) not null default 0,
  delivery_estimate_kes numeric(12, 2) not null default 0,
  total_kes numeric(12, 2) not null default 0,
  unmatched_count int not null default 0,
  status text not null default 'quoted' check (status in ('quoted', 'converted')),
  created_at timestamptz not null default now(),
  converted_order_id uuid references public.orders (id) on delete set null
);

create index if not exists quote_requests_user_idx on public.quote_requests (user_id);
create index if not exists quote_requests_created_idx on public.quote_requests (created_at desc);

alter table public.quote_requests enable row level security;

create policy "Anyone can submit a quote request"
  on public.quote_requests for insert
  with check (true);

create policy "Owner or admin reads quote requests"
  on public.quote_requests for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Owner or admin updates quote requests"
  on public.quote_requests for update
  using (auth.uid() = user_id or public.is_admin());

grant select, insert on public.quote_requests to anon, authenticated;
grant update on public.quote_requests to authenticated;

-- Guest-safe fetch immediately after insert (same RETURNING-vs-RLS problem as orders).
create or replace function public.get_quote_request(p_id uuid)
returns jsonb
language sql
security definer
set search_path = public
as $$
  select to_jsonb(q) from public.quote_requests q where q.id = p_id;
$$;

revoke all on function public.get_quote_request(uuid) from public;
grant execute on function public.get_quote_request(uuid) to anon, authenticated;
