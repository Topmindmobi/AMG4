-- Rider vehicle type (motorcycle/van/truck) for AMG -> customer last-mile
-- delivery, so dispatch can pick an appropriate vehicle for heavy orders.

alter table public.riders
  add column if not exists vehicle text not null default 'boda'
    check (vehicle in ('boda', 'van', 'truck'));

alter table public.orders
  add column if not exists rider_vehicle_snapshot text;

-- The original riders.town check predates the app's move to nationwide
-- coverage (it only allowed the 3 pilot towns) — widen it so the new admin
-- rider form can save a rider based in any of the app's towns.
alter table public.riders drop constraint if exists riders_town_check;
alter table public.riders
  add constraint riders_town_check
  check (town in ('Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori'));
