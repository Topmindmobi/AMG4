-- Archive delivered orders (admin pipeline hygiene only — a buyer's own view
-- of their delivered order is unaffected, see account/orders and order/[id]).
--
-- Also closes a latent gap: set_order_status() (022) never set delivered_at
-- when moving an order to 'delivered' through the general admin pipeline —
-- only the rider-kanban path (set_rider_delivery_status, 014/016/023) did.
-- A single BEFORE UPDATE trigger (not per-RPC code) sets both delivered_at
-- and archived_at no matter which RPC (existing or future) flips status to
-- 'delivered'.

alter table public.orders
  add column if not exists archived_at timestamptz;

create index if not exists orders_archived_at_idx on public.orders (archived_at);

create or replace function public.orders_set_delivered_and_archived()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'delivered' and (old.status is distinct from new.status) then
    new.delivered_at := coalesce(new.delivered_at, now());
    new.archived_at := coalesce(new.archived_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists trg_orders_set_delivered_and_archived on public.orders;
create trigger trg_orders_set_delivered_and_archived
  before update on public.orders
  for each row
  execute function public.orders_set_delivered_and_archived();
