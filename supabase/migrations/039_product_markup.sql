-- Admin-controlled markup on top of supplier-set product prices. Suppliers
-- keep setting their own base price (supplier_price_kes); admin applies a
-- markup (percent or flat, admin's choice per product); price_kes becomes
-- the always-computed customer-facing price = supplier_price_kes + markup,
-- so every existing read site (shop, cart, supplier ranking, reports, etc.)
-- keeps working unchanged. A product is hidden from customers until admin
-- has deliberately set a markup (markup_type is not null).

alter table public.products
  add column supplier_price_kes numeric(12,2),
  add column markup_type text check (markup_type in ('percent', 'flat')),
  add column markup_value numeric(12,2);

-- Backfill: existing rows keep their current customer price unchanged —
-- explicit zero markup (reviewed), not null (pending), so nothing already
-- live goes dark today.
update public.products
  set supplier_price_kes = price_kes, markup_type = 'flat', markup_value = 0
  where supplier_price_kes is null;

alter table public.products alter column supplier_price_kes set not null;

-- Compute price_kes from supplier_price_kes + markup, and strip markup_type/
-- markup_value from any write that isn't from an admin — RLS is row-level
-- only ("Suppliers manage own products" is `for all` with no column split),
-- so this is the only place that can enforce "only admin sets markup,"
-- mirroring the same trigger pattern already used for profiles
-- (036_profiles_protect_privileged_columns.sql).
create or replace function public.products_compute_price()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if TG_OP = 'INSERT' then
      new.markup_type := null;
      new.markup_value := null;
    else
      new.markup_type := old.markup_type;
      new.markup_value := old.markup_value;
    end if;
  end if;

  new.price_kes := round(
    new.supplier_price_kes + case
      when new.markup_type = 'percent' then new.supplier_price_kes * coalesce(new.markup_value, 0) / 100
      when new.markup_type = 'flat' then coalesce(new.markup_value, 0)
      else 0
    end,
    2
  );
  return new;
end;
$$;

drop trigger if exists trg_products_compute_price on public.products;
create trigger trg_products_compute_price
  before insert or update on public.products
  for each row
  execute function public.products_compute_price();

-- Visibility gate: customers only see products admin has reviewed.
-- Suppliers/admins still see their own via the existing separate policies
-- (RLS policies are OR'd) — only the public-read policy changes.
drop policy "Anyone can read active products" on public.products;
create policy "Anyone can read reviewed active products"
  on public.products for select
  using (is_active = true and markup_type is not null);
