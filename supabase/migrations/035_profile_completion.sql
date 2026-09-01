-- Riders and suppliers can self-register (030_role_applications.sql), but no
-- signup path (Google OAuth or email/password) has ever collected more than
-- full_name — phone/town are set later, and address/city/country/pin
-- location have never existed on profiles at all. This adds them plus a
-- one-time "have we already redirected this user to complete their
-- profile" marker so the soft-prompt flow only force-redirects once ever;
-- a persistent banner (driven by field-completeness, not this column)
-- keeps reminding them after that.

alter table public.profiles
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists country text not null default 'Kenya',
  add column if not exists lat numeric,
  add column if not exists lng numeric,
  add column if not exists maps_url text,
  add column if not exists profile_prompt_shown_at timestamptz;

-- No RLS changes needed: "Users update own profile" (001_schema.sql) has
-- `using (auth.uid() = id)` with no `with check`, so Postgres already
-- reuses `using` as the check — a user can update any column on their own
-- row today, new ones included.
