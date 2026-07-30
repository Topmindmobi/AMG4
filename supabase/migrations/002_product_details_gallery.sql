-- Short + detailed descriptions and image gallery
alter table public.products
  add column if not exists short_description text not null default '',
  add column if not exists detailed_description text not null default '',
  add column if not exists gallery text[] not null default '{}';

-- Backfill from legacy description column if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'description'
  ) then
    update public.products
    set
      short_description = case when short_description = '' then coalesce(description, '') else short_description end,
      detailed_description = case when detailed_description = '' then coalesce(description, '') else detailed_description end
    where short_description = '' or detailed_description = '';
  end if;
end $$;
