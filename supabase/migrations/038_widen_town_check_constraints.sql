-- Pre-existing bug found while testing the new mandatory buyer profile
-- form: `profiles`, `suppliers`, `orders`, `dropoff_points`, and
-- `quote_requests` still restrict `town` to the original 3-town service
-- area (Homabay/Mbita/Migori), while `riders`/`supplier_addresses`/
-- `role_applications` were already correctly widened to the full 6-town
-- set the storefront actually supports (Nairobi/Mombasa/Kisumu/Homabay/
-- Mbita/Migori — see TOWNS in src/lib/format.ts). Any real customer in
-- Nairobi, Mombasa, or Kisumu writing their town to any of these five
-- tables (placing an order, requesting a quote, self-registering as a
-- supplier, completing their profile) has been silently rejected by
-- Postgres — not a hypothetical, reproduced live during testing.
--
-- Widening only (no data can violate a wider constraint that already
-- satisfied the narrower one), so this is a zero-risk migration for
-- existing rows.

alter table public.profiles drop constraint profiles_town_check;
alter table public.profiles add constraint profiles_town_check
  check (town = any (array['Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori']));

alter table public.suppliers drop constraint suppliers_town_check;
alter table public.suppliers add constraint suppliers_town_check
  check (town = any (array['Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori']));

alter table public.orders drop constraint orders_town_check;
alter table public.orders add constraint orders_town_check
  check (town = any (array['Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori']));

alter table public.dropoff_points drop constraint dropoff_points_town_check;
alter table public.dropoff_points add constraint dropoff_points_town_check
  check (town = any (array['Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori']));

alter table public.quote_requests drop constraint quote_requests_town_check;
alter table public.quote_requests add constraint quote_requests_town_check
  check (town = any (array['Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori']));
