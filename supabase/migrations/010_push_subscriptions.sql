-- Web Push subscriptions (rider payout alerts, order status pushes).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Admins read push subscriptions"
  on public.push_subscriptions for select
  using (public.is_admin());
