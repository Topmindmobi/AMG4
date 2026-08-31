-- Supplier address management has been entirely demo-only since it was
-- built: src/components/supplier/SupplierAddressesManager.tsx calls only
-- demo-store functions with no isDemoMode() branch, and this table never
-- existed under any name (confirmed by grep across every prior migration).
-- In production this silently ran against browser localStorage only.
--
-- This also silently degraded admin's "rank suppliers by distance" feature
-- (src/lib/supplier-selection.ts's rankSuppliersForOrder()): with no table
-- to read from, admin/orders/page.tsx's real-mode data load never fetched
-- addresses, so every distance calculation fell back to the crude
-- TOWN_DISTANCE_KM lookup instead of a supplier's actual pinned location.

create table if not exists public.supplier_addresses (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers (id) on delete cascade,
  label text not null check (label in ('warehouse', 'shop', 'pickup', 'other')),
  name text not null,
  town text not null check (town in ('Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori')),
  line1 text not null,
  phone text,
  maps_url text,
  lat numeric,
  lng numeric,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists supplier_addresses_supplier_idx on public.supplier_addresses (supplier_id);

-- At most one default address per supplier — enforced by the DB, not just
-- the demo-store's JS-only invariant (src/lib/store/demo/catalog.ts).
create unique index if not exists supplier_addresses_one_default_idx
  on public.supplier_addresses (supplier_id)
  where is_default;

alter table public.supplier_addresses enable row level security;

create policy "Admins manage supplier addresses"
  on public.supplier_addresses for all
  using (public.is_admin());

-- Reuses the existing is_supplier_of() helper (004_supplier_workflow.sql),
-- already used for supply_requests/products — never used for this table
-- because the table never existed.
create policy "Suppliers manage own addresses"
  on public.supplier_addresses for all
  using (public.is_supplier_of(supplier_id))
  with check (public.is_supplier_of(supplier_id));
