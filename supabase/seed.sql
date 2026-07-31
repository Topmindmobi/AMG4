-- Seed categories, suppliers, and sample products for AMG.COM
-- Run after 001_schema.sql in the Supabase SQL editor.

insert into public.categories (id, slug, name, parent_id, sort_order, description) values
  ('11111111-1111-1111-1111-111111111001', 'electronics', 'Electronics', null, 1, 'Laptops, computers, phones, printers and accessories'),
  ('11111111-1111-1111-1111-111111111002', 'laptops-computers', 'Laptops & Computers', '11111111-1111-1111-1111-111111111001', 1, null),
  ('11111111-1111-1111-1111-111111111003', 'phones', 'Phones & Accessories', '11111111-1111-1111-1111-111111111001', 2, null),
  ('11111111-1111-1111-1111-111111111004', 'printers', 'Printers', '11111111-1111-1111-1111-111111111001', 3, null),
  ('11111111-1111-1111-1111-111111111005', 'household-appliances', 'Household Appliances', null, 2, 'TVs, fridges, washing machines and more'),
  ('11111111-1111-1111-1111-111111111006', 'fashion-clothing', 'Fashion & Clothing', null, 3, null),
  ('11111111-1111-1111-1111-111111111007', 'beauty-cosmetics', 'Beauty & Cosmetics', null, 4, null),
  ('11111111-1111-1111-1111-111111111008', 'furniture', 'Furniture', null, 5, null),
  ('11111111-1111-1111-1111-111111111009', 'home-decor', 'Home Decor', null, 6, null),
  ('11111111-1111-1111-1111-111111111010', 'farm-tools', 'Farm Tools & Equipment', null, 7, null),
  ('11111111-1111-1111-1111-111111111011', 'beddings', 'Beddings', null, 8, null),
  ('11111111-1111-1111-1111-111111111012', 'kitchen-wares', 'Kitchen Wares', null, 9, null),
  ('11111111-1111-1111-1111-111111111013', 'toys', 'Toys for Children', null, 10, null),
  ('11111111-1111-1111-1111-111111111014', 'sporting-equipment', 'Sporting Equipment', null, 11, null),
  ('11111111-1111-1111-1111-111111111015', 'school-books', 'School Books / Bookshop', null, 12, null),
  ('11111111-1111-1111-1111-111111111016', 'agricultural-products', 'Agricultural Products', null, 13, 'Fresh produce, meat, fish and staples'),
  ('11111111-1111-1111-1111-111111111017', 'hardware', 'Hardware', null, 14, 'Cement, iron sheets, paints, electricals');

insert into public.suppliers (id, name, contact_phone, town, notes) values
  ('22222222-2222-2222-2222-222222222001', 'Lakeview Electronics', '0722001100', 'Homabay', 'Laptops, phones, printers'),
  ('22222222-2222-2222-2222-222222222002', 'Ruma Fresh Farms', '0722002200', 'Mbita', 'Eggs, fish, produce'),
  ('22222222-2222-2222-2222-222222222003', 'Migori Hardware Hub', '0722003300', 'Migori', 'Cement, iron sheets, paints');

insert into public.products (category_id, supplier_id, name, slug, description, price_kes, stock, towns, image_path) values
  ('11111111-1111-1111-1111-111111111002', '22222222-2222-2222-2222-222222222001', 'HP 15 Laptop 8GB/256GB', 'hp-15-laptop', 'Reliable everyday laptop for school and work.', 52000, 12, array['Homabay','Mbita'], '/products/hp-15-laptop.jpg'),
  ('11111111-1111-1111-1111-111111111002', '22222222-2222-2222-2222-222222222001', 'Wireless Mouse & Keyboard Combo', 'wireless-mouse-keyboard', 'USB dongle combo for desktops and laptops.', 2500, 40, array['Homabay','Mbita','Migori'], '/products/wireless-mouse-keyboard.jpg'),
  ('11111111-1111-1111-1111-111111111003', '22222222-2222-2222-2222-222222222001', 'Samsung A15 128GB', 'samsung-a15', 'Dual SIM smartphone with long battery life.', 18500, 25, array['Homabay','Mbita'], '/products/samsung-a15.jpg'),
  ('11111111-1111-1111-1111-111111111003', '22222222-2222-2222-2222-222222222001', 'Type-C Fast Charger 25W', 'type-c-fast-charger', 'Compatible with most Android phones.', 1200, 80, array['Homabay','Mbita','Migori'], '/products/type-c-fast-charger.jpg'),
  ('11111111-1111-1111-1111-111111111004', '22222222-2222-2222-2222-222222222001', 'Epson EcoTank L3250', 'epson-l3250', 'Wi-Fi all-in-one ink tank printer.', 28000, 6, array['Homabay'], '/products/epson-l3250.jpg'),
  ('11111111-1111-1111-1111-111111111005', '22222222-2222-2222-2222-222222222001', '32" Smart LED TV', 'smart-led-tv-32', 'HD smart TV with streaming apps.', 22000, 10, array['Homabay','Mbita'], '/products/smart-led-tv-32.jpg'),
  ('11111111-1111-1111-1111-111111111005', '22222222-2222-2222-2222-222222222001', 'Electric Iron Box', 'electric-iron-box', 'Steam iron with non-stick soleplate.', 1800, 30, array['Homabay','Mbita','Migori'], '/products/electric-iron-box.jpg'),
  ('11111111-1111-1111-1111-111111111005', '22222222-2222-2222-2222-222222222001', 'Mini Fridge 90L', 'mini-fridge-90l', 'Ideal for small homes and shops.', 24500, 5, array['Homabay'], '/products/mini-fridge-90l.jpg'),
  ('11111111-1111-1111-1111-111111111006', null, 'Men''s Casual Shirt', 'mens-casual-shirt', 'Breathable cotton shirt, assorted colours.', 1500, 50, array['Homabay','Mbita','Migori'], '/products/mens-casual-shirt.jpg'),
  ('11111111-1111-1111-1111-111111111006', null, 'Ladies Ankara Dress', 'ladies-ankara-dress', 'Vibrant local print dress.', 2200, 35, array['Homabay','Mbita'], '/products/ladies-ankara-dress.jpg'),
  ('11111111-1111-1111-1111-111111111007', null, 'Shea Butter Body Lotion 400ml', 'shea-body-lotion', 'Moisturising lotion for daily use.', 650, 60, array['Homabay','Mbita','Migori'], '/products/shea-body-lotion.jpg'),
  ('11111111-1111-1111-1111-111111111008', null, 'Plastic Armchair', 'plastic-armchair', 'Durable outdoor/indoor chair.', 1200, 40, array['Homabay','Migori'], '/products/plastic-armchair.jpg'),
  ('11111111-1111-1111-1111-111111111010', '22222222-2222-2222-2222-222222222003', 'Jembe (Hoe)', 'jembe-hoe', 'Heavy-duty farming hoe.', 800, 100, array['Homabay','Mbita','Migori'], '/products/jembe-hoe.jpg'),
  ('11111111-1111-1111-1111-111111111016', '22222222-2222-2222-2222-222222222002', 'Fresh Eggs (Tray of 30)', 'fresh-eggs-tray', 'Farm-fresh eggs from local suppliers.', 550, 80, array['Homabay','Mbita'], '/products/fresh-eggs-tray.jpg'),
  ('11111111-1111-1111-1111-111111111016', '22222222-2222-2222-2222-222222222002', 'Tilapia Fish (1kg)', 'tilapia-1kg', 'Fresh lake tilapia, cleaned on request.', 450, 50, array['Mbita','Homabay'], '/products/tilapia-1kg.jpg'),
  ('11111111-1111-1111-1111-111111111016', '22222222-2222-2222-2222-222222222002', 'Maize Flour 2kg', 'maize-flour-2kg', 'Fine sifted maize flour.', 220, 120, array['Homabay','Mbita','Migori'], '/products/maize-flour-2kg.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'Cement 50kg Bag', 'cement-50kg', 'Portland cement for construction.', 950, 200, array['Homabay','Migori'], '/products/cement-50kg.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'Iron Sheet Gauge 28 (3m)', 'iron-sheet-28', 'Corrugated roofing sheet.', 1200, 90, array['Homabay','Mbita','Migori'], '/products/iron-sheet-28.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'Emulsion Paint 4L', 'emulsion-paint-4l', 'Interior wall paint, white.', 1800, 35, array['Homabay','Migori'], '/products/emulsion-paint-4l.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'Steel Nails 1kg (Assorted)', 'steel-nails-1kg', 'Mixed steel nails for timber and roofing work.', 250, 150, array['Homabay','Mbita','Migori'], '/products/cement-50kg.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'River Sand (Ton)', 'river-sand-ton', 'One ton of river sand for concrete and plastering.', 3500, 40, array['Homabay','Mbita','Migori'], '/products/cement-50kg.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'Ballast (Ton)', 'ballast-ton', 'One ton of crushed stone ballast for foundations.', 4200, 30, array['Homabay','Migori'], '/products/cement-50kg.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'Timber 2x3 (12ft)', 'timber-2x3-12ft', '12ft sawn timber for framing and roofing.', 450, 200, array['Homabay','Mbita','Migori'], '/products/cement-50kg.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'PVC Water Pipe 1" (3m)', 'pvc-pipe-1-inch-3m', '3m PVC pressure pipe for water plumbing.', 650, 120, array['Homabay','Migori'], '/products/cement-50kg.jpg'),
  ('11111111-1111-1111-1111-111111111017', '22222222-2222-2222-2222-222222222003', 'Electrical Wire 2.5mm (100m Roll)', 'electrical-wire-2-5mm-100m', '100m roll of 2.5mm² copper electrical cable.', 6800, 25, array['Homabay','Mbita','Migori'], '/products/cement-50kg.jpg'),
  ('11111111-1111-1111-1111-111111111015', null, 'KCPE Revision Bundle', 'kcpe-revision-bundle', 'Core subject revision pack.', 2400, 40, array['Homabay','Mbita','Migori'], '/products/kcpe-revision-bundle.jpg');

insert into public.riders (id, name, phone, town) values
  ('33333333-3333-3333-3333-333333333001', 'Brian Otieno', '0733001100', 'Homabay'),
  ('33333333-3333-3333-3333-333333333002', 'Faith Anyango', '0733002200', 'Mbita'),
  ('33333333-3333-3333-3333-333333333003', 'Kevin Omondi', '0733003300', 'Migori');

insert into public.dropoff_points (id, town, name, description) values
  ('44444444-4444-4444-4444-444444444001', 'Homabay', 'AMG Hub — Arujo Road', 'Next to Arujo Road matatu stage, opposite Equity Bank.'),
  ('44444444-4444-4444-4444-444444444002', 'Homabay', 'Homabay Bus Park Kiosk', 'AMG collection kiosk at the main bus park.'),
  ('44444444-4444-4444-4444-444444444003', 'Mbita', 'Mbita Pier Market Stall', 'Market stall row near the ferry pier.'),
  ('44444444-4444-4444-4444-444444444004', 'Mbita', 'Mbita Town Square Kiosk', 'Beside the town square boda stage.'),
  ('44444444-4444-4444-4444-444444444005', 'Migori', 'Migori Hardware Row', 'Hardware Row, near Migori Hardware Hub.'),
  ('44444444-4444-4444-4444-444444444006', 'Migori', 'Migori Bus Terminal Kiosk', 'AMG collection kiosk at the bus terminal.');

-- After creating an auth user for admin@amg.com in the dashboard, promote with:
-- update public.profiles set role = 'admin' where id = '<user-uuid>';
--
-- To create a rider login: create the auth user (e.g. brian@amg.com), then:
-- update public.profiles set role = 'rider', rider_id = '33333333-3333-3333-3333-333333333001' where id = '<user-uuid>';
