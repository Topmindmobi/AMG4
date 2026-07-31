-- STEP 1/2 — run this alone in Supabase SQL Editor, then run step 2.
-- https://supabase.com/dashboard/project/xavotkqffqucfndbrbid/sql/new

do $$ begin
  alter type public.user_role add value if not exists 'supplier';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.user_role add value if not exists 'rider';
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

create table if not exists public.riders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  town text check (town in ('Homabay', 'Mbita', 'Migori')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists rider_id uuid references public.riders (id) on delete set null;

insert into public.suppliers (id, name, contact_phone, town, notes) values
  ('22222222-2222-2222-2222-222222222001', 'Lakeview Electronics', '0722001100', 'Homabay', 'Laptops, phones, printers'),
  ('22222222-2222-2222-2222-222222222002', 'Ruma Fresh Farms', '0722002200', 'Mbita', 'Eggs, fish, produce'),
  ('22222222-2222-2222-2222-222222222003', 'Migori Hardware Hub', '0722003300', 'Migori', 'Cement, iron sheets, paints')
on conflict (id) do update set
  name = excluded.name,
  contact_phone = excluded.contact_phone,
  town = excluded.town,
  notes = excluded.notes;

insert into public.riders (id, name, phone, town) values
  ('33333333-3333-3333-3333-333333333001', 'Brian Otieno', '0733001100', 'Homabay'),
  ('33333333-3333-3333-3333-333333333002', 'Faith Anyango', '0733002200', 'Mbita'),
  ('33333333-3333-3333-3333-333333333003', 'Kevin Omondi', '0733003300', 'Migori')
on conflict (id) do update set
  name = excluded.name,
  phone = excluded.phone,
  town = excluded.town;
