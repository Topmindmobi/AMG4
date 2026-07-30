-- Supplier role + supply request workflow

do $$ begin
  alter type public.user_role add value if not exists 'supplier';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.order_status add value if not exists 'awaiting_supplier';
  alter type public.order_status add value if not exists 'supplier_confirmed';
exception when duplicate_object then null;
end $$;

alter table public.profiles
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null;

alter table public.order_items
  add column if not exists supplier_id uuid references public.suppliers (id) on delete set null,
  add column if not exists supplier_name_snapshot text;

alter table public.orders
  add column if not exists buyer_notified_at timestamptz;

create table if not exists public.supply_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  supplier_id uuid not null references public.suppliers (id),
  supplier_name text not null,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected')),
  items jsonb not null default '[]',
  total_kes numeric(12, 2) not null,
  customer_town text not null,
  delivery_note text not null default '',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique (order_id, supplier_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  order_id uuid references public.orders (id) on delete set null,
  supply_request_id uuid references public.supply_requests (id) on delete set null
);

alter table public.supply_requests enable row level security;
alter table public.notifications enable row level security;

create or replace function public.is_supplier_of(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'supplier' and supplier_id = sid
  );
$$;

create policy "Admins manage supply requests"
  on public.supply_requests for all
  using (public.is_admin());

create policy "Suppliers read own supply requests"
  on public.supply_requests for select
  using (public.is_supplier_of(supplier_id));

create policy "Suppliers confirm own supply requests"
  on public.supply_requests for update
  using (public.is_supplier_of(supplier_id));

create policy "Users read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "Admins insert notifications"
  on public.notifications for insert
  with check (public.is_admin() or true);

-- Suppliers may insert/update their own products
create policy "Suppliers manage own products"
  on public.products for all
  using (
    public.is_admin()
    or (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.role = 'supplier'
          and p.supplier_id = products.supplier_id
      )
    )
  );
