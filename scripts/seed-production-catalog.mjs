/**
 * Seed the real Supabase products catalog for launch.
 *
 * Only the 30 products with genuinely their-own photos are included — 6 demo
 * products (steel-nails-1kg, river-sand-ton, ballast-ton, timber-2x3-12ft,
 * pvc-pipe-1-inch-3m, electrical-wire-2-5mm-100m) reused another product's
 * (cement-50kg) photo set in demo mode and were dropped rather than shipped
 * with mismatched images.
 *
 * Demo data uses fake string ids ("cat-electronics", "sup-1", ...) which
 * aren't valid Postgres uuids, so this script lets the DB generate real
 * uuids and maps slug/name -> generated id before inserting products.
 *
 * Usage: node --env-file=.env.local scripts/seed-production-catalog.mjs
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TOP_CATEGORIES = [
  { slug: "electronics", name: "Electronics", sort_order: 1, description: "Laptops, computers, phones, printers and accessories" },
  { slug: "household-appliances", name: "Household Appliances", sort_order: 2, description: "TVs, fridges, washing machines and more" },
  { slug: "fashion-clothing", name: "Fashion & Clothing", sort_order: 3 },
  { slug: "beauty-cosmetics", name: "Beauty & Cosmetics", sort_order: 4 },
  { slug: "furniture", name: "Furniture", sort_order: 5 },
  { slug: "home-decor", name: "Home Decor", sort_order: 6 },
  { slug: "farm-tools", name: "Farm Tools & Equipment", sort_order: 7 },
  { slug: "beddings", name: "Beddings", sort_order: 8 },
  { slug: "kitchen-wares", name: "Kitchen Wares", sort_order: 9 },
  { slug: "toys", name: "Toys for Children", sort_order: 10 },
  { slug: "sporting-equipment", name: "Sporting Equipment", sort_order: 11 },
  { slug: "school-books", name: "School Books / Bookshop", sort_order: 12 },
  { slug: "agricultural-products", name: "Agricultural Products", sort_order: 13, description: "Fresh produce, meat, fish and staples" },
  { slug: "hardware", name: "Hardware", sort_order: 14, description: "Cement, iron sheets, paints, electricals" },
];

const CHILD_CATEGORIES = [
  { slug: "laptops-computers", name: "Laptops & Computers", parent: "electronics", sort_order: 1 },
  { slug: "phones", name: "Phones & Accessories", parent: "electronics", sort_order: 2 },
  { slug: "printers", name: "Printers", parent: "electronics", sort_order: 3 },
];

const SUPPLIERS = [
  { key: "lakeview", name: "Lakeview Electronics", contact_phone: "0722001100", town: "Homabay", notes: "Laptops, phones, printers" },
  { key: "ruma", name: "Ruma Fresh Farms", contact_phone: "0722002200", town: "Mbita", notes: "Eggs, fish, produce" },
  { key: "migori", name: "Migori Hardware Hub", contact_phone: "0722003300", town: "Migori", notes: "Cement, iron sheets, paints" },
];

// category: slug from TOP_CATEGORIES/CHILD_CATEGORIES; supplier: key from SUPPLIERS or null
function product(category, supplier, name, slug, short_description, detailed_description, price_kes, stock, towns) {
  return {
    category,
    supplier,
    name,
    slug,
    short_description,
    detailed_description,
    description: short_description,
    price_kes,
    stock,
    image_path: `/products/${slug}.jpg`,
    gallery: [`/products/${slug}-2.jpg`, `/products/${slug}-3.jpg`, `/products/${slug}-4.jpg`],
    towns,
    is_active: true,
  };
}

const PRODUCTS = [
  product("laptops-computers", "lakeview", "HP 15 Laptop 8GB/256GB", "hp-15-laptop", "Everyday laptop for school, office work, and browsing.", "The HP 15 is a dependable laptop for students and small businesses around Homabay and Mbita. It comes with 8GB RAM and a 256GB SSD for fast boot times, a full-size keyboard for typing notes or reports, and Wi‑Fi for online classes or M‑Pesa business tools. Ideal for Word, Excel, Zoom, and light design. Local warranty support available through AMG.COM partner shops. Delivery by motorcycle within pilot towns.", 52000, 12, ["Homabay", "Mbita"]),
  product("laptops-computers", "lakeview", "Wireless Mouse & Keyboard Combo", "wireless-mouse-keyboard", "Plug-and-play USB combo for desktops and laptops.", "This wireless mouse and keyboard set uses a single USB dongle, so you avoid cable clutter on shop counters or home desks. Soft keys reduce typing noise, and the mouse fits either hand. Compatible with Windows and most Linux setups. Batteries included. Perfect add-on when buying a laptop from AMG.COM or upgrading an older PC.", 2500, 40, ["Homabay", "Mbita", "Migori"]),
  product("phones", "lakeview", "Samsung A15 128GB", "samsung-a15", "Dual-SIM Android phone with strong battery for daily use.", "Samsung Galaxy A15 (128GB) gives you room for photos, WhatsApp, and school apps. Dual SIM lets you separate work and personal lines—useful for traders and boda operators. The display is bright outdoors, and the battery lasts a full day of calls and social media. Comes sealed with charger. Available for pickup or motorcycle delivery in Homabay and Mbita.", 18500, 25, ["Homabay", "Mbita"]),
  product("phones", "lakeview", "Type-C Fast Charger 25W", "type-c-fast-charger", "25W USB‑C wall charger for phones and small tablets.", "Charge compatible Android phones faster with this 25W USB‑C adapter. Compact for travel between Homabay, Mbita, and Migori. Includes cable. Built-in protection against overheating. Works with most modern Type‑C devices. Keep a spare at home and another at the shop.", 1200, 80, ["Homabay", "Mbita", "Migori"]),
  product("printers", "lakeview", "Epson EcoTank L3250", "epson-l3250", "Wi‑Fi ink-tank printer for home and small office.", "Epson EcoTank L3250 prints, scans, and copies without expensive cartridges—refillable ink tanks cut cost per page. Connect over Wi‑Fi from your phone or laptop. Great for school notes, receipts, and church or SACCO documents. Setup help available at our Homabay pilot shop. Ink starter bottles included.", 28000, 6, ["Homabay"]),
  product("household-appliances", "lakeview", "32\" Smart LED TV", "smart-led-tv-32", "HD smart TV with built-in streaming apps.", "Enjoy news, football, and YouTube on this 32-inch HD Smart LED TV. Connect to Wi‑Fi for Netflix and other apps, or use HDMI for a decoder. Slim design fits small sitting rooms and rental units. Energy-efficient LED panel. Delivery and basic wall-mount advice available in Homabay and Mbita.", 22000, 10, ["Homabay", "Mbita"]),
  product("household-appliances", "lakeview", "2-Burner Gas Cooker", "gas-cooker-2b", "Compact two-burner cooker for busy home kitchens.", "Cook ugali, sukuma, and tea side by side on this sturdy 2-burner gas cooker. Compact footprint suits small kitchens. Easy-clean enamel surface. Compatible with standard LPG cylinders used locally. Inspect hose and regulator regularly for safety. Available in Homabay and Migori.", 8500, 15, ["Homabay", "Migori"]),
  product("household-appliances", "lakeview", "Electric Iron Box", "electric-iron-box", "Steam iron with non-stick soleplate for daily clothes.", "Smooth shirts, school uniforms, and lesos quickly with this electric steam iron. Non-stick soleplate glides on cotton and polyester. Adjustable heat settings. Lightweight for everyday use. Ideal for homes, hotels, and laundry side businesses.", 1800, 30, ["Homabay", "Mbita", "Migori"]),
  product("household-appliances", "lakeview", "Mini Fridge 90L", "mini-fridge-90l", "90L fridge for drinks, leftovers, and shop stock.", "This 90-litre mini fridge cools drinks, milk, and leftovers without taking a full kitchen. Quiet compressor suits bedrooms, offices, and dukas. Adjustable shelves. Runs on standard power. Limited stock in Homabay—order early for delivery.", 24500, 5, ["Homabay"]),
  product("fashion-clothing", null, "Men's Casual Shirt", "mens-casual-shirt", "Breathable cotton shirt in assorted colours.", "A smart-casual cotton shirt for church, market days, or office. Soft fabric for Lake Victoria heat. Assorted colours and regular sizes. Easy to wash and iron. Pair with trousers from our fashion section. Confirm size on delivery if unsure.", 1500, 50, ["Homabay", "Mbita", "Migori"]),
  product("fashion-clothing", null, "Ladies Ankara Dress", "ladies-ankara-dress", "Vibrant Ankara print dress for events and everyday wear.", "Stand out in a colourful Ankara dress tailored for comfort. Suitable for weddings, sundays, and celebrations. Soft lining feel with room to move. Assorted prints—message us after order if you prefer a specific colour family. Available in Homabay and Mbita.", 2200, 35, ["Homabay", "Mbita"]),
  product("beauty-cosmetics", null, "Shea Butter Body Lotion 400ml", "shea-body-lotion", "Daily moisturising lotion enriched with shea butter.", "Nourish dry skin with this 400ml shea butter body lotion. Absorbs well without sticky residue—good after bathing or farming outdoors. Mild scent. Suitable for family use. Store away from direct sun. Fast-moving beauty item across all pilot towns.", 650, 60, ["Homabay", "Mbita", "Migori"]),
  product("furniture", null, "Plastic Armchair", "plastic-armchair", "Durable chair for indoor or outdoor seating.", "Stackable plastic armchair for homes, events, and waiting areas. Weather-resistant for verandas. Easy to wipe clean. Light enough to move, strong enough for daily use. Sold as single units—order multiples for halls or meetings.", 1200, 40, ["Homabay", "Migori"]),
  product("furniture", null, "4ft Wooden Coffee Table", "wooden-coffee-table", "Solid wood coffee table for living rooms.", "Anchor your sitting room with this 4ft wooden coffee table. Smooth finish for cups, remotes, and décor. Sturdy legs for uneven floors common in many homes. Wipe with a dry cloth. Delivery includes careful handling within Homabay.", 6500, 8, ["Homabay"]),
  product("home-decor", null, "Wall Mirror with Frame", "wall-mirror-frame", "Decorative framed mirror for bedrooms and hallways.", "Brighten a room and check your outfit with this framed wall mirror. Suitable for bedrooms, salons, and guest rooms. Includes hanging hardware guidance. Glass is packed for safe motorcycle delivery. Available in Homabay and Mbita.", 2800, 14, ["Homabay", "Mbita"]),
  product("farm-tools", "migori", "Jembe (Hoe)", "jembe-hoe", "Heavy-duty hoe for shambas and kitchen gardens.", "Classic jembe for digging, weeding, and planting. Strong metal blade with wooden handle. Built for daily farm work around Homabay, Mbita, and Migori. Check handle fit on receipt. Bulk orders welcome for groups and schools.", 800, 100, ["Homabay", "Mbita", "Migori"]),
  product("farm-tools", "migori", "Knapsack Sprayer 16L", "knapsack-sprayer", "16L manual sprayer for crops and compounds.", "Apply pesticides, herbicides, or foliar feed evenly with this 16-litre knapsack sprayer. Adjustable nozzle, padded straps for long walks across shambas. Rinse thoroughly after chemical use. Training tip sheets available on request from Migori Hardware Hub partners.", 3500, 20, ["Homabay", "Migori"]),
  product("beddings", null, "Cotton Bedsheet Set (6x6)", "cotton-bedsheet-6x6", "6x6 cotton set with duvet cover and pillowcases.", "Refresh your bed with a soft cotton 6x6 sheet set. Includes fitted/flat sheet style pack, duvet cover, and pillowcases (as packed). Assorted prints. Machine washable. Ideal wedding or house-warming gift. Stocked for Homabay and Mbita delivery.", 3200, 22, ["Homabay", "Mbita"]),
  product("kitchen-wares", null, "Stainless Cooking Pot Set (5pc)", "cooking-pot-set", "Five-piece stainless pot set for everyday cooking.", "Cook stews, githeri, and rice in this durable 5-piece stainless steel pot set. Even heat distribution, lids included. Easy to clean after oily meals. Nested storage saves space. A staple set for new homes and busy kitchens.", 4500, 18, ["Homabay", "Mbita", "Migori"]),
  product("toys", null, "Kids Learning Tablet Toy", "kids-learning-tablet", "Educational toy tablet with lights, sounds, and letters.", "Keep children learning through play with this interactive tablet toy. Introduces letters, numbers, and music. Bright screen-style panel (toy electronics—not a real tablet). Ages 3+. Requires batteries (may be sold separately). Great gift for birthdays.", 1800, 25, ["Homabay", "Mbita"]),
  product("sporting-equipment", null, "Football Size 5", "football-size-5", "Size 5 match ball for training and school games.", "Official size 5 football for academies, schools, and estate matches. Durable outer for dusty pitches. Pump separately if needed. Encourages youth sports across Homabay, Mbita, and Migori. Bulk pricing for clubs—contact AMG.COM after order.", 1500, 30, ["Homabay", "Mbita", "Migori"]),
  product("school-books", null, "KCPE Revision Bundle", "kcpe-revision-bundle", "Core subject revision pack for KCPE candidates.", "Prepare for KCPE with this revision bundle covering key primary subjects. Practice questions and notes aligned to the curriculum. Suitable for candidates and holiday coaching. Encourage daily timed practice. Delivered sealed across pilot towns.", 2400, 40, ["Homabay", "Mbita", "Migori"]),
  product("agricultural-products", "ruma", "Fresh Eggs (Tray of 30)", "fresh-eggs-tray", "Farm-fresh eggs, tray of 30 from local suppliers.", "Thirty fresh eggs sourced via Ruma Fresh Farms partners. Ideal for homes, hotels, and dukas. Handle gently on delivery—motorcycle riders pack with care. Best used within the week; refrigerate if possible. Order cut-off may apply for same-day Mbita/Homabay runs.", 550, 80, ["Homabay", "Mbita"]),
  product("agricultural-products", "ruma", "Tilapia Fish (1kg)", "tilapia-1kg", "Fresh lake tilapia, about 1kg, cleaned on request.", "Enjoy Lake Victoria tilapia sold by the kilo. Request cleaning/gutting in the order notes. Same-day freshness focus for Mbita and Homabay. Cook fried, wet fry, or stew. Keep cool after delivery. Price may vary slightly with fish size—we confirm before dispatch if needed.", 450, 50, ["Mbita", "Homabay"]),
  product("agricultural-products", "ruma", "Maize Flour 2kg", "maize-flour-2kg", "Fine sifted maize flour for ugali and porridge.", "2kg pack of fine sifted maize flour for soft ugali and porridge. Store in a dry place away from weevils. Popular household staple. Available across Homabay, Mbita, and Migori with regular restocks.", 220, 120, ["Homabay", "Mbita", "Migori"]),
  product("agricultural-products", "ruma", "Green Grams 1kg", "green-grams-1kg", "Dry ndengu (green grams), 1kg pack.", "Clean dry green grams for stews and githeri mixes. 1kg pack. Sort and rinse before cooking. Protein-rich and budget-friendly. Store sealed. Homabay and Migori delivery windows.", 280, 70, ["Homabay", "Migori"]),
  product("agricultural-products", "ruma", "Ripe Bananas (Bunch)", "ripe-bananas-bunch", "Sweet ripe bananas sold per bunch.", "Ready-to-eat ripe bananas for snacking and kids’ lunchboxes. Bunch size varies with harvest—we aim for a fair market bunch. Best ordered for same-day or next-day delivery to keep firmness. Homabay and Mbita routes.", 150, 60, ["Homabay", "Mbita"]),
  product("hardware", "migori", "Cement 50kg Bag", "cement-50kg", "Portland cement, 50kg bag for building works.", "Standard 50kg Portland cement for foundations, plaster, and block work. Keep dry until use. Heavy item—delivery may use reinforced packing or pickup from Migori/Homabay points. Confirm site access for motorcycle vs. arranged drop.", 950, 200, ["Homabay", "Migori"]),
  product("hardware", "migori", "Iron Sheet Gauge 28 (3m)", "iron-sheet-28", "3m corrugated iron sheet, gauge 28.", "Gauge 28 corrugated iron sheet (3m) for roofing and sheds. Check colour/finish options when ordering. Edges are sharp—handle with gloves. Bundled carefully for transport. Available across Homabay, Mbita, and Migori.", 1200, 90, ["Homabay", "Mbita", "Migori"]),
  product("hardware", "migori", "Emulsion Paint 4L", "emulsion-paint-4l", "4-litre interior emulsion paint, white.", "Refresh walls with 4L white emulsion paint for interior rooms. Good coverage on plastered surfaces. Stir well; apply with roller or brush. Allow drying between coats. Clean tools with water while wet. Homabay and Migori stock.", 1800, 35, ["Homabay", "Migori"]),
];

async function upsertCategories(list, parentMap) {
  const map = { ...parentMap };
  for (const cat of list) {
    const row = {
      slug: cat.slug,
      name: cat.name,
      sort_order: cat.sort_order,
      description: cat.description ?? null,
      parent_id: cat.parent ? map[cat.parent] : null,
    };
    const { data, error } = await admin
      .from("categories")
      .upsert(row, { onConflict: "slug" })
      .select("id, slug")
      .single();
    if (error) throw new Error(`category ${cat.slug}: ${error.message}`);
    map[cat.slug] = data.id;
    console.log("category", cat.slug, "->", data.id);
  }
  return map;
}

async function findOrCreateSuppliers() {
  const map = {};
  for (const s of SUPPLIERS) {
    const { data: existing, error: selErr } = await admin
      .from("suppliers")
      .select("id")
      .eq("name", s.name)
      .maybeSingle();
    if (selErr) throw new Error(`supplier lookup ${s.name}: ${selErr.message}`);
    if (existing) {
      map[s.key] = existing.id;
      console.log("supplier", s.key, "existing ->", existing.id);
      continue;
    }
    const { data, error } = await admin
      .from("suppliers")
      .insert({ name: s.name, contact_phone: s.contact_phone, town: s.town, notes: s.notes })
      .select("id")
      .single();
    if (error) throw new Error(`supplier ${s.key}: ${error.message}`);
    map[s.key] = data.id;
    console.log("supplier", s.key, "created ->", data.id);
  }
  return map;
}

async function upsertProducts(categoryMap, supplierMap) {
  for (const p of PRODUCTS) {
    const row = {
      category_id: categoryMap[p.category],
      supplier_id: p.supplier ? supplierMap[p.supplier] : null,
      name: p.name,
      slug: p.slug,
      description: p.description,
      short_description: p.short_description,
      detailed_description: p.detailed_description,
      price_kes: p.price_kes,
      stock: p.stock,
      image_path: p.image_path,
      gallery: p.gallery,
      towns: p.towns,
      is_active: p.is_active,
    };
    if (!row.category_id) throw new Error(`product ${p.slug}: unknown category "${p.category}"`);
    const { error } = await admin.from("products").upsert(row, { onConflict: "slug" });
    if (error) throw new Error(`product ${p.slug}: ${error.message}`);
    console.log("product", p.slug, "ok");
  }
}

async function main() {
  const topMap = await upsertCategories(TOP_CATEGORIES, {});
  const fullCategoryMap = await upsertCategories(CHILD_CATEGORIES, topMap);
  const supplierMap = await findOrCreateSuppliers();
  await upsertProducts(fullCategoryMap, supplierMap);
  console.log(`\nSeeded ${TOP_CATEGORIES.length + CHILD_CATEGORIES.length} categories, ${SUPPLIERS.length} suppliers, ${PRODUCTS.length} products.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
