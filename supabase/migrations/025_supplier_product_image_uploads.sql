-- Bug fix: suppliers get "new row violates row-level security policy" when
-- adding a product with a photo (captured on phone or uploaded) from
-- src/components/admin/ProductForm.tsx, which is shared by both the admin
-- and supplier portals (see src/app/supplier/products/new/page.tsx).
--
-- Root cause: 001_schema.sql's storage.objects policies for the
-- 'product-images' bucket only ever allowed public.is_admin(). 004's
-- "Suppliers manage own products" policy gave suppliers full access to the
-- products TABLE, but nobody updated the storage-bucket policies to match —
-- so a supplier's own product row saves fine, but their photo upload (which
-- happens first, before the product row exists) has always been rejected.
--
-- The uploaded path (`${Date.now()}-${filename}` / `gallery-...`) carries no
-- product/supplier id to check ownership against — a fresh image is uploaded
-- to storage before the product row it'll be attached to is even inserted.
-- So this can't be scoped any tighter than "any supplier account", matching
-- how broadly 004 already scoped product-table access.

drop policy if exists "Admins upload product images" on storage.objects;
drop policy if exists "Admins update product images" on storage.objects;
drop policy if exists "Admins delete product images" on storage.objects;

create policy "Admins and suppliers upload product images"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'supplier'
      )
    )
  );

create policy "Admins and suppliers update product images"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'supplier'
      )
    )
  );

create policy "Admins and suppliers delete product images"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and (
      public.is_admin()
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'supplier'
      )
    )
  );
