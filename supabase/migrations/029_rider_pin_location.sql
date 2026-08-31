-- Riders only ever carried a flat `town` string — dispatch pickers
-- (admin/orders/page.tsx, OrderStatusKanban.tsx) list town-matching riders
-- in whatever order the DB returns them, with no real distance ranking.
-- A rider is one person with one base location, not a business with
-- multiple warehouses, so (unlike suppliers' supplier_addresses table) a
-- single optional pin directly on the riders row is enough.

alter table public.riders
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists maps_url text;
