-- Minimal schema so demo supplier/rider logins work.
-- Run in Supabase Dashboard → SQL Editor → New query → Run
-- Project: https://supabase.com/dashboard/project/xavotkqffqucfndbrbid/sql/new

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

-- Promote demo Auth users (must already exist — created by ensure-demo-users.mjs)
update public.profiles p
set
  full_name = 'AMG Admin',
  role = 'admin',
  phone = '0700000000',
  town = 'Homabay',
  supplier_id = null,
  rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'admin@amg.com';

update public.profiles p
set
  full_name = 'Achieng Otieno',
  role = 'customer',
  phone = '0712345678',
  town = 'Mbita',
  supplier_id = null,
  rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'customer@amg.com';

update public.profiles p
set
  full_name = 'Lakeview Electronics',
  role = 'supplier',
  phone = '0722001100',
  town = 'Homabay',
  supplier_id = '22222222-2222-2222-2222-222222222001',
  rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'lakeview@amg.com';

update public.profiles p
set
  full_name = 'Ruma Fresh Farms',
  role = 'supplier',
  phone = '0722002200',
  town = 'Mbita',
  supplier_id = '22222222-2222-2222-2222-222222222002',
  rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'ruma@amg.com';

update public.profiles p
set
  full_name = 'Migori Hardware Hub',
  role = 'supplier',
  phone = '0722003300',
  town = 'Migori',
  supplier_id = '22222222-2222-2222-2222-222222222003',
  rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'migori@amg.com';

update public.profiles p
set
  full_name = 'Brian Otieno',
  role = 'rider',
  phone = '0733001100',
  town = 'Homabay',
  supplier_id = null,
  rider_id = '33333333-3333-3333-3333-333333333001'
from auth.users u
where p.id = u.id and lower(u.email) = 'brian@amg.com';

update public.profiles p
set
  full_name = 'Faith Anyango',
  role = 'rider',
  phone = '0733002200',
  town = 'Mbita',
  supplier_id = null,
  rider_id = '33333333-3333-3333-3333-333333333002'
from auth.users u
where p.id = u.id and lower(u.email) = 'faith@amg.com';

update public.profiles p
set
  full_name = 'Kevin Omondi',
  role = 'rider',
  phone = '0733003300',
  town = 'Migori',
  supplier_id = null,
  rider_id = '33333333-3333-3333-3333-333333333003'
from auth.users u
where p.id = u.id and lower(u.email) = 'kevin@amg.com';
