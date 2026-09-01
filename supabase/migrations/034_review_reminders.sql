-- Nudge buyers to review a delivered, unrated order every 3 days, max 2
-- reminders, then stop regardless of whether they ever rate it. Selection
-- logic lives in a security-definer RPC (not hand-built supabase-js filter
-- chains) because the "count=0 AND 3-days-since-delivery" OR "count=1 AND
-- 3-days-since-last-reminder" condition doesn't translate cleanly into the
-- JS query builder's .or() string syntax. Both RPCs are called only by the
-- cron route's service-role client, which bypasses RLS anyway — grants are
-- restricted to service_role for documentation/defense-in-depth, not
-- because RLS would otherwise block them.

alter table public.orders
  add column if not exists review_reminder_count int not null default 0,
  add column if not exists review_reminder_last_sent_at timestamptz;

create index if not exists orders_review_reminder_idx
  on public.orders (status, review_reminder_count)
  where status = 'delivered';

create or replace function public.get_pending_review_reminders(p_limit int default 200)
returns setof public.orders
language sql
stable
security definer
set search_path = public
as $$
  select o.*
  from public.orders o
  where o.status = 'delivered'
    and o.review_reminder_count < 2
    and not exists (select 1 from public.order_ratings r where r.order_id = o.id)
    and (
      (o.review_reminder_count = 0 and o.delivered_at is not null
        and o.delivered_at <= now() - interval '3 days')
      or (o.review_reminder_count = 1 and o.review_reminder_last_sent_at is not null
        and o.review_reminder_last_sent_at <= now() - interval '3 days')
    )
  order by o.delivered_at asc
  limit p_limit;
$$;

create or replace function public.mark_review_reminder_sent(p_order_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.orders
  set review_reminder_count = review_reminder_count + 1,
      review_reminder_last_sent_at = now()
  where id = p_order_id;
$$;

revoke all on function public.get_pending_review_reminders(int) from public;
grant execute on function public.get_pending_review_reminders(int) to service_role;
revoke all on function public.mark_review_reminder_sent(uuid) from public;
grant execute on function public.mark_review_reminder_sent(uuid) to service_role;

-- pg_cron + pg_net scheduling. Hourly cadence is cheap (indexed query,
-- typically zero rows) and fine-grained enough against a 3-day window.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- IMPORTANT: do NOT hardcode the bearer secret here. Run this once via the
-- Supabase SQL editor (not committed to a migration file):
--   select vault.create_secret('<the actual CRON_SECRET value>', 'cron_secret');
-- Then this schedule call (which IS safe to commit — it only references the
-- secret by name) reads it at execution time.
select cron.schedule(
  'review-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://amgstores.ai/api/cron/review-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
