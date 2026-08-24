-- Pay-now discount, doorstep/drop-off delivery choice, and rider role.

do $$ begin
  alter type public.user_role add value if not exists 'rider';
exception when duplicate_object then null;
end $$;

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  town text check (town in ('Homabay', 'Mbita', 'Migori')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dropoff_points (
  id uuid primary key default gen_random_uuid(),
  town text not null check (town in ('Homabay', 'Mbita', 'Migori')),
  name text not null,
  description text
);

alter table public.profiles
  add column if not exists rider_id uuid references public.riders (id) on delete set null;

alter table public.orders
  add column if not exists email text,
  add column if not exists paid boolean not null default false,
  add column if not exists paid_at timestamptz,
  add column if not exists subtotal_kes numeric(12, 2),
  add column if not exists discount_kes numeric(12, 2) not null default 0,
  add column if not exists delivery_method text not null default 'doorstep'
    check (delivery_method in ('doorstep', 'dropoff')),
  add column if not exists dropoff_point_id uuid references public.dropoff_points (id) on delete set null,
  add column if not exists dropoff_point_name text,
  add column if not exists rider_id uuid references public.riders (id) on delete set null,
  add column if not exists rider_name_snapshot text,
  add column if not exists delivered_at timestamptz;

-- Backfill subtotal for any pre-existing rows (no discount was possible before this migration).
update public.orders set subtotal_kes = total_kes where subtotal_kes is null;
alter table public.orders alter column subtotal_kes set not null;

alter table public.riders enable row level security;
alter table public.dropoff_points enable row level security;

create or replace function public.is_rider_of(rid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'rider' and rider_id = rid
  );
$$;

create policy "Anyone can read active riders"
  on public.riders for select
  using (active = true or public.is_admin());

create policy "Admins manage riders"
  on public.riders for all
  using (public.is_admin());

create policy "Anyone can read dropoff points"
  on public.dropoff_points for select
  using (true);

create policy "Admins manage dropoff points"
  on public.dropoff_points for all
  using (public.is_admin());

-- Riders need to see (and the app needs to render) orders assigned to them.
create policy "Riders read assigned orders"
  on public.orders for select
  using (public.is_rider_of(rider_id));
