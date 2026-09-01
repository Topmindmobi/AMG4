-- Security fix: "Users update own profile" (001_schema.sql) has
-- `using (auth.uid() = id)` with no `with check` — Postgres reuses `using`
-- as the check, so any authenticated user can currently update ANY column
-- on their own profiles row via a plain client `.update()`, including:
--   - role: self-promote to 'admin'.
--   - supplier_id / rider_id: point at an arbitrary existing supplier or
--     rider. is_supplier_of()/is_rider_of() (004/007) key purely off
--     `profiles.supplier_id = sid` / `profiles.rider_id = rid` for
--     auth.uid() — so this isn't just cosmetic, it grants real access to
--     that supplier's supply_requests/addresses or that rider's payouts
--     and deliveries.
--
-- Fix: a BEFORE UPDATE trigger that resets role/supplier_id/rider_id back
-- to their prior values whenever a *self-service* update (auth.uid() is
-- set, i.e. a real user session) is made by a non-admin. Deliberately NOT
-- a `with check` clause on the existing policy, because Postgres RLS
-- checks can't see OLD column values to compare against — a trigger can.
--
-- This does not affect: (a) approve_role_application()/reject_role_
-- application() (030_role_applications.sql), which are admin-gated
-- (`if not is_admin() then raise exception`) before they ever reach the
-- `update profiles set role = ...` — the caller passes is_admin(), so the
-- trigger's own is_admin() check also passes and it's a no-op; (b) any
-- backend call using the service-role key (auth.uid() is null in that
-- context, e.g. /api/account/delete), which is already fully trusted and
-- bypasses RLS entirely — the trigger explicitly skips those too, since
-- restricting them would just be friction with no security benefit (a
-- service-role key already has unrestricted table access).

create or replace function public.profiles_protect_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.supplier_id := old.supplier_id;
    new.rider_id := old.rider_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_protect_privileged_columns on public.profiles;
create trigger trg_profiles_protect_privileged_columns
  before update on public.profiles
  for each row
  execute function public.profiles_protect_privileged_columns();
