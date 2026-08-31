-- Bug fix: a supplier account has never been able to read its own row in
-- public.suppliers — the only SELECT policy from 001_schema.sql is
-- `using (public.is_admin())`. 004_supplier_workflow.sql gave suppliers
-- full write access to their own PRODUCTS but never added supplier read
-- access to their own supplier org record, so any page that looks up
-- "my own supplier row" (e.g. src/app/supplier/addresses/page.tsx's
-- town-default lookup) has always returned nothing for a real supplier
-- account, RLS-silently, in production.

drop policy if exists "Admins read suppliers" on public.suppliers;

create policy "Admins read suppliers"
  on public.suppliers for select
  using (
    public.is_admin()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'supplier' and p.supplier_id = suppliers.id
    )
  );
