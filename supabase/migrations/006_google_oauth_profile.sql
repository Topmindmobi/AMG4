-- Ensure Google OAuth users get a profiles row with a usable display name.
-- Google stores the name in raw_user_meta_data->>'name' (and sometimes full_name).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
      nullif(trim(new.raw_user_meta_data->>'name'), ''),
      ''
    ),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
