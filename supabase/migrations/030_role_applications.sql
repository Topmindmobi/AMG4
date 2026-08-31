-- Suppliers and riders have always been pure admin-created data rows with
-- zero login capability (no auth user, no profiles link, no invite flow
-- anywhere in the codebase). This adds self-registration: an existing
-- logged-in customer applies with KYC documents, an admin reviews and
-- approves/rejects, and only on approval does the applicant's profile
-- actually become a supplier/rider (role + supplier_id/rider_id set) —
-- until then role stays 'customer', which the existing useRoleGuard()
-- already relies on to keep them out of /supplier and /rider.

create type public.role_application_type as enum ('supplier', 'rider');
create type public.role_application_status as enum ('pending', 'approved', 'rejected');

create table public.role_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.role_application_type not null,
  status public.role_application_status not null default 'pending',
  business_name text,          -- supplier only
  vehicle text,                -- rider only
  -- Snapshot, not a join — same convention as orders.email/orders.phone,
  -- and avoids the admin queue needing an auth.users lookup just to email
  -- the applicant a decision.
  email text not null,
  contact_phone text not null,
  town text not null check (town in ('Nairobi', 'Mombasa', 'Kisumu', 'Homabay', 'Mbita', 'Migori')),
  notes text,
  national_id_path text,
  business_permit_path text,   -- supplier only
  driving_license_path text,   -- rider only
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index role_applications_user_idx on public.role_applications (user_id);

-- At most one PENDING application per user per type — stops duplicate
-- spam submissions while still allowing resubmission after a rejection.
create unique index role_applications_one_pending_idx
  on public.role_applications (user_id, type)
  where status = 'pending';

alter table public.role_applications enable row level security;

create policy "Users manage own applications"
  on public.role_applications for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "Admins manage all applications"
  on public.role_applications for all
  using (public.is_admin());

-- Private bucket: KYC documents are sensitive PII, unlike product-images.
insert into storage.buckets (id, name, public)
values ('kyc-documents', 'kyc-documents', false)
on conflict (id) do nothing;

-- Uploads are path-prefixed by the uploader's own user id
-- ({user_id}/{doc-type}-{timestamp}.jpg), so ownership is just a foldername
-- check — same shape as every other per-owner storage policy in this repo.
create policy "Users manage own KYC documents"
  on storage.objects for all
  using (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'kyc-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Admins read KYC documents"
  on storage.objects for select
  using (bucket_id = 'kyc-documents' and public.is_admin());

create or replace function public.approve_role_application(p_application_id uuid)
returns public.role_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.role_applications%rowtype;
  v_full_name text;
  v_supplier_id uuid;
  v_rider_id uuid;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_app from public.role_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Application is not pending';
  end if;

  select full_name into v_full_name from public.profiles where id = v_app.user_id;

  if v_app.type = 'supplier' then
    insert into public.suppliers (name, contact_phone, town, notes)
    values (coalesce(v_app.business_name, v_full_name, 'Supplier'), v_app.contact_phone, v_app.town, v_app.notes)
    returning id into v_supplier_id;

    update public.profiles
      set role = 'supplier', supplier_id = v_supplier_id
      where id = v_app.user_id;
  else
    insert into public.riders (name, phone, town, vehicle, active)
    values (coalesce(v_full_name, 'Rider'), v_app.contact_phone, v_app.town, coalesce(v_app.vehicle, 'boda'), true)
    returning id into v_rider_id;

    update public.profiles
      set role = 'rider', rider_id = v_rider_id
      where id = v_app.user_id;
  end if;

  update public.role_applications
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_application_id
    returning * into v_app;

  return v_app;
end;
$$;

create or replace function public.reject_role_application(p_application_id uuid, p_reason text)
returns public.role_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_app public.role_applications%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  select * into v_app from public.role_applications where id = p_application_id for update;
  if not found then
    raise exception 'Application not found';
  end if;
  if v_app.status <> 'pending' then
    raise exception 'Application is not pending';
  end if;

  update public.role_applications
    set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = p_reason
    where id = p_application_id
    returning * into v_app;

  return v_app;
end;
$$;

revoke all on function public.approve_role_application(uuid) from public;
grant execute on function public.approve_role_application(uuid) to authenticated;
revoke all on function public.reject_role_application(uuid, text) from public;
grant execute on function public.reject_role_application(uuid, text) to authenticated;
