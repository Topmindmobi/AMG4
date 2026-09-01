-- Customer-facing ratings (order + delivery + per-line-item product),
-- distinct from the admin-only, demo-only service_ratings concept in
-- src/lib/types.ts (ServiceRating / RatingSubject) — that one rates supplier
-- response/goods/rider quality for AMG's internal use; this one is the
-- buyer's own review of their delivered order, publicly readable (industry
-- standard for storefront reviews).

create table public.order_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  overall_rating smallint not null check (overall_rating between 1 and 5),
  delivery_rating smallint not null check (delivery_rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.product_ratings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  order_item_id uuid not null references public.order_items (id) on delete cascade,
  -- Denormalized snapshot of order_items.product_id at rating time, so a
  -- future "average rating on the product page" query can join straight off
  -- products without traversing order_items; kept nullable to mirror
  -- order_items.product_id's own on-delete-set-null semantics.
  product_id uuid references public.products (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  review_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_item_id, user_id)
);

create index order_ratings_order_idx on public.order_ratings (order_id);
create index product_ratings_order_idx on public.product_ratings (order_id);
create index product_ratings_product_idx on public.product_ratings (product_id);

alter table public.order_ratings enable row level security;
alter table public.product_ratings enable row level security;

-- Public read (future product-page display) — no insert/update policy on
-- either table; all writes go through submit_order_rating() below, same
-- "RPC-only" shape as callback_requests (024).
create policy "Anyone can read order ratings"
  on public.order_ratings for select
  using (true);

create policy "Anyone can read product ratings"
  on public.product_ratings for select
  using (true);

create or replace function public.submit_order_rating(
  p_order_id uuid,
  p_overall_rating smallint,
  p_delivery_rating smallint,
  p_review_text text,
  p_product_ratings jsonb  -- [{ "order_item_id": uuid, "rating": smallint, "review_text": text }]
)
returns public.order_ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_rating public.order_ratings%rowtype;
  v_item jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.user_id is distinct from auth.uid() then
    raise exception 'Not your order';
  end if;
  if v_order.status <> 'delivered' then
    raise exception 'Order must be delivered before it can be rated';
  end if;
  if p_overall_rating not between 1 and 5 or p_delivery_rating not between 1 and 5 then
    raise exception 'Ratings must be 1-5';
  end if;

  insert into public.order_ratings (order_id, user_id, overall_rating, delivery_rating, review_text)
  values (p_order_id, auth.uid(), p_overall_rating, p_delivery_rating, nullif(trim(coalesce(p_review_text, '')), ''))
  on conflict (order_id) do update
    set overall_rating = excluded.overall_rating,
        delivery_rating = excluded.delivery_rating,
        review_text = excluded.review_text,
        updated_at = now()
  returning * into v_rating;

  for v_item in select * from jsonb_array_elements(coalesce(p_product_ratings, '[]'::jsonb))
  loop
    if not exists (
      select 1 from public.order_items
      where id = (v_item->>'order_item_id')::uuid and order_id = p_order_id
    ) then
      raise exception 'Item % does not belong to this order', v_item->>'order_item_id';
    end if;

    insert into public.product_ratings (order_id, order_item_id, product_id, user_id, rating, review_text)
    select p_order_id, (v_item->>'order_item_id')::uuid, oi.product_id, auth.uid(),
           (v_item->>'rating')::smallint,
           nullif(trim(coalesce(v_item->>'review_text', '')), '')
    from public.order_items oi
    where oi.id = (v_item->>'order_item_id')::uuid
    on conflict (order_item_id, user_id) do update
      set rating = excluded.rating,
          review_text = excluded.review_text,
          updated_at = now();
  end loop;

  return v_rating;
end;
$$;

revoke all on function public.submit_order_rating(uuid, smallint, smallint, text, jsonb) from public;
grant execute on function public.submit_order_rating(uuid, smallint, smallint, text, jsonb) to authenticated;
