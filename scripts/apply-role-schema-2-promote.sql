-- STEP 2/2 — run AFTER step 1 succeeds (new enum values must be committed first).
-- https://supabase.com/dashboard/project/xavotkqffqucfndbrbid/sql/new

update public.profiles p
set full_name = 'AMG Admin', role = 'admin', phone = '0700000000', town = 'Homabay',
    supplier_id = null, rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'admin@amg.com';

update public.profiles p
set full_name = 'Achieng Otieno', role = 'customer', phone = '0712345678', town = 'Mbita',
    supplier_id = null, rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'customer@amg.com';

update public.profiles p
set full_name = 'Lakeview Electronics', role = 'supplier', phone = '0722001100', town = 'Homabay',
    supplier_id = '22222222-2222-2222-2222-222222222001', rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'lakeview@amg.com';

update public.profiles p
set full_name = 'Ruma Fresh Farms', role = 'supplier', phone = '0722002200', town = 'Mbita',
    supplier_id = '22222222-2222-2222-2222-222222222002', rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'ruma@amg.com';

update public.profiles p
set full_name = 'Migori Hardware Hub', role = 'supplier', phone = '0722003300', town = 'Migori',
    supplier_id = '22222222-2222-2222-2222-222222222003', rider_id = null
from auth.users u
where p.id = u.id and lower(u.email) = 'migori@amg.com';

update public.profiles p
set full_name = 'Brian Otieno', role = 'rider', phone = '0733001100', town = 'Homabay',
    supplier_id = null, rider_id = '33333333-3333-3333-3333-333333333001'
from auth.users u
where p.id = u.id and lower(u.email) = 'brian@amg.com';

update public.profiles p
set full_name = 'Faith Anyango', role = 'rider', phone = '0733002200', town = 'Mbita',
    supplier_id = null, rider_id = '33333333-3333-3333-3333-333333333002'
from auth.users u
where p.id = u.id and lower(u.email) = 'faith@amg.com';

update public.profiles p
set full_name = 'Kevin Omondi', role = 'rider', phone = '0733003300', town = 'Migori',
    supplier_id = null, rider_id = '33333333-3333-3333-3333-333333333003'
from auth.users u
where p.id = u.id and lower(u.email) = 'kevin@amg.com';
