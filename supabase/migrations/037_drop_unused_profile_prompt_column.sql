-- profiles.profile_prompt_shown_at (035_profile_completion.sql) tracked a
-- one-time soft "complete your profile" redirect. That flow is replaced by
-- a hard, mandatory onboarding gate (choose-role -> buyer profile form /
-- rider-seller application, no skip) — this column has no remaining
-- purpose.

alter table public.profiles
  drop column if exists profile_prompt_shown_at;
