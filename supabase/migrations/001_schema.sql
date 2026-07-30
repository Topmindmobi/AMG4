-- AMG.COM marketplace schema
create extension if not exists "pgcrypto";

create type public.user_role as enum ('customer', 'admin');
create type public.order_status as enum (
  'pending',
  'confirmed',
  'out_for_delivery',
  'delivered',
  'cancelled'
);
create type public.payment_method as enum ('cod', 'mpesa');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  role public.user_role not null default 'customer',
  town text check (town in ('Homabay', 'Mbita', 'Migori')),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  parent_id uuid references public.categories (id) on delete set null,
  sort_order int not null default 0,
  description text
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_phone text,
  town text check (town in ('Homabay', 'Mbita', 'Migori')),
  notes text,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories (id),
  supplier_id uuid references public.suppliers (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  short_description text not null default '',
  detailed_description text not null default '',
  price_kes numeric(12, 2) not null check (price_kes >= 0),
  stock int not null default 0 check (stock >= 0),
  image_path text,
  gallery text[] not null default '{}',
  barcode text,
  towns text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists products_barcode_unique
  on public.products (barcode)
  where barcode is not null and barcode <> '';

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  phone text not null,
  town text not null check (town in ('Homabay', 'Mbita', 'Migori')),
  address text not null,
  payment_method public.payment_method not null,
  mpesa_phone text,
  status public.order_status not null default 'pending',
  total_kes numeric(12, 2) not null check (total_kes >= 0),
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name_snapshot text not null,
  price_kes numeric(12, 2) not null,
  qty int not null check (qty > 0)
);

create index products_category_idx on public.products (category_id);
create index products_active_idx on public.products (is_active);
create index orders_user_idx on public.orders (user_id);
create index orders_status_idx on public.orders (status);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      ''
    ),
    'customer'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Helper: is admin
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Profiles
create policy "Public profiles readable by owner or admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

create policy "Users update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins manage profiles"
  on public.profiles for all
  using (public.is_admin());

-- Categories
create policy "Anyone can read categories"
  on public.categories for select
  using (true);

create policy "Admins manage categories"
  on public.categories for all
  using (public.is_admin());

-- Suppliers
create policy "Admins read suppliers"
  on public.suppliers for select
  using (public.is_admin());

create policy "Admins manage suppliers"
  on public.suppliers for all
  using (public.is_admin());

-- Products
create policy "Anyone can read active products"
  on public.products for select
  using (is_active = true or public.is_admin());

create policy "Admins manage products"
  on public.products for all
  using (public.is_admin());

-- Orders
create policy "Users read own orders"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

create policy "Anyone can create orders"
  on public.orders for insert
  with check (true);

create policy "Admins update orders"
  on public.orders for update
  using (public.is_admin());

-- Order items
create policy "Read order items with order access"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Anyone can insert order items"
  on public.order_items for insert
  with check (true);

create policy "Admins manage order items"
  on public.order_items for all
  using (public.is_admin());

-- Storage bucket for product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Public read product images"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Admins upload product images"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

create policy "Admins update product images"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

create policy "Admins delete product images"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());
