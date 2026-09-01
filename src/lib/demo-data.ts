import type {
  Category,
  DropoffPoint,
  Order,
  Product,
  Profile,
  Rider,
  Supplier,
  SupplierAddress,
  Town,
} from "./types";

const now = "2026-07-01T10:00:00.000Z";

export const DEMO_ADMIN: Profile = {
  id: "demo-admin",
  full_name: "AMG Admin",
  phone: "0700000000",
  role: "admin",
  town: "Homabay",
  supplier_id: null,
  rider_id: null,
  created_at: now,
};

export const DEMO_CUSTOMER: Profile = {
  id: "demo-customer",
  full_name: "Achieng Otieno",
  phone: "0712345678",
  role: "customer",
  town: "Mbita",
  supplier_id: null,
  rider_id: null,
  created_at: now,
};

export const DEMO_SUPPLIER_USERS: Profile[] = [
  {
    id: "demo-supplier-1",
    full_name: "Lakeview Electronics",
    phone: "0722001100",
    role: "supplier",
    town: "Homabay",
    supplier_id: "sup-1",
    rider_id: null,
    created_at: now,
  },
  {
    id: "demo-supplier-2",
    full_name: "Ruma Fresh Farms",
    phone: "0722002200",
    role: "supplier",
    town: "Mbita",
    supplier_id: "sup-2",
    rider_id: null,
    created_at: now,
  },
  {
    id: "demo-supplier-3",
    full_name: "Migori Hardware Hub",
    phone: "0722003300",
    role: "supplier",
    town: "Migori",
    supplier_id: "sup-3",
    rider_id: null,
    created_at: now,
  },
];

export const DEMO_RIDERS: Rider[] = [
  {
    id: "rider-1",
    name: "Brian Otieno",
    phone: "0733001100",
    town: "Homabay",
    vehicle: "boda",
    active: true,
    created_at: now,
    // Pinned base (near Homabay town centre) so the demo ranking has at
    // least one precise-distance rider alongside the town-fallback ones.
    lat: -0.5301,
    lng: 34.4612,
    maps_url: "https://www.google.com/maps?q=-0.5301,34.4612",
  },
  {
    id: "rider-2",
    name: "Faith Anyango",
    phone: "0733002200",
    town: "Mbita",
    vehicle: "van",
    active: true,
    created_at: now,
  },
  {
    id: "rider-3",
    name: "Kevin Omondi",
    phone: "0733003300",
    town: "Migori",
    vehicle: "truck",
    active: true,
    created_at: now,
  },
];

export const DEMO_RIDER_USERS: Profile[] = [
  {
    id: "demo-rider-1",
    full_name: "Brian Otieno",
    phone: "0733001100",
    role: "rider",
    town: "Homabay",
    supplier_id: null,
    rider_id: "rider-1",
    created_at: now,
  },
  {
    id: "demo-rider-2",
    full_name: "Faith Anyango",
    phone: "0733002200",
    role: "rider",
    town: "Mbita",
    supplier_id: null,
    rider_id: "rider-2",
    created_at: now,
  },
  {
    id: "demo-rider-3",
    full_name: "Kevin Omondi",
    phone: "0733003300",
    role: "rider",
    town: "Migori",
    supplier_id: null,
    rider_id: "rider-3",
    created_at: now,
  },
];

export const DEMO_DROPOFF_POINTS: DropoffPoint[] = [
  {
    id: "drop-homabay-1",
    town: "Homabay",
    name: "AMG Hub — Arujo Road",
    description: "Next to Arujo Road matatu stage, opposite Equity Bank.",
  },
  {
    id: "drop-homabay-2",
    town: "Homabay",
    name: "Homabay Bus Park Kiosk",
    description: "AMG collection kiosk at the main bus park.",
  },
  {
    id: "drop-mbita-1",
    town: "Mbita",
    name: "Mbita Pier Market Stall",
    description: "Market stall row near the ferry pier.",
  },
  {
    id: "drop-mbita-2",
    town: "Mbita",
    name: "Mbita Town Square Kiosk",
    description: "Beside the town square boda stage.",
  },
  {
    id: "drop-migori-1",
    town: "Migori",
    name: "Migori Hardware Row",
    description: "Hardware Row, near Migori Hardware Hub.",
  },
  {
    id: "drop-migori-2",
    town: "Migori",
    name: "Migori Bus Terminal Kiosk",
    description: "AMG collection kiosk at the bus terminal.",
  },
];

export const DEMO_SUPPLIERS: Supplier[] = [
  {
    id: "sup-1",
    name: "Lakeview Electronics",
    contact_phone: "0722001100",
    town: "Homabay",
    notes: "Laptops, phones, printers",
    created_at: now,
  },
  {
    id: "sup-2",
    name: "Ruma Fresh Farms",
    contact_phone: "0722002200",
    town: "Mbita",
    notes: "Eggs, fish, produce",
    created_at: now,
  },
  {
    id: "sup-3",
    name: "Migori Hardware Hub",
    contact_phone: "0722003300",
    town: "Migori",
    notes: "Cement, iron sheets, paints",
    created_at: now,
  },
];

/** Seed origin addresses (manual + map pins) for distance / transport ranking. */
export const DEMO_SUPPLIER_ADDRESSES: SupplierAddress[] = [
  {
    id: "saddr-1",
    supplier_id: "sup-1",
    label: "shop",
    name: "Lakeview shop — Arujo",
    town: "Homabay",
    line1: "Arujo Road, next to Equity Bank",
    phone: "0722001100",
    maps_url: "https://www.google.com/maps?q=-0.5301,34.4612",
    lat: -0.5301,
    lng: 34.4612,
    is_default: true,
    created_at: now,
  },
  {
    id: "saddr-2",
    supplier_id: "sup-2",
    label: "warehouse",
    name: "Ruma packing shed",
    town: "Mbita",
    line1: "Near Mbita Pier market, packing shed gate B",
    phone: "0722002200",
    maps_url: "https://www.google.com/maps?q=-0.4258,34.2089",
    lat: -0.4258,
    lng: 34.2089,
    is_default: true,
    created_at: now,
  },
  {
    id: "saddr-3",
    supplier_id: "sup-3",
    label: "warehouse",
    name: "Hardware Row yard",
    town: "Migori",
    line1: "Hardware Row, behind Migori Hardware Hub",
    phone: "0722003300",
    maps_url: "https://www.google.com/maps?q=-1.0682,34.4785",
    lat: -1.0682,
    lng: 34.4785,
    is_default: true,
    created_at: now,
  },
];

export const DEMO_CATEGORIES: Category[] = [
  { id: "cat-electronics", slug: "electronics", name: "Electronics", parent_id: null, sort_order: 1, description: "Laptops, computers, phones, printers and accessories" },
  { id: "cat-laptops", slug: "laptops-computers", name: "Laptops & Computers", parent_id: "cat-electronics", sort_order: 1 },
  { id: "cat-phones", slug: "phones", name: "Phones & Accessories", parent_id: "cat-electronics", sort_order: 2 },
  { id: "cat-printers", slug: "printers", name: "Printers", parent_id: "cat-electronics", sort_order: 3 },
  { id: "cat-appliances", slug: "household-appliances", name: "Household Appliances", parent_id: null, sort_order: 2, description: "TVs, fridges, washing machines and more" },
  { id: "cat-fashion", slug: "fashion-clothing", name: "Fashion & Clothing", parent_id: null, sort_order: 3 },
  { id: "cat-beauty", slug: "beauty-cosmetics", name: "Beauty & Cosmetics", parent_id: null, sort_order: 4 },
  { id: "cat-furniture", slug: "furniture", name: "Furniture", parent_id: null, sort_order: 5 },
  { id: "cat-decor", slug: "home-decor", name: "Home Decor", parent_id: null, sort_order: 6 },
  { id: "cat-farm-tools", slug: "farm-tools", name: "Farm Tools & Equipment", parent_id: null, sort_order: 7 },
  { id: "cat-beddings", slug: "beddings", name: "Beddings", parent_id: null, sort_order: 8 },
  { id: "cat-kitchen", slug: "kitchen-wares", name: "Kitchen Wares", parent_id: null, sort_order: 9 },
  { id: "cat-toys", slug: "toys", name: "Toys for Children", parent_id: null, sort_order: 10 },
  { id: "cat-sport", slug: "sporting-equipment", name: "Sporting Equipment", parent_id: null, sort_order: 11 },
  { id: "cat-books", slug: "school-books", name: "School Books / Bookshop", parent_id: null, sort_order: 12 },
  { id: "cat-agri", slug: "agricultural-products", name: "Agricultural Products", parent_id: null, sort_order: 13, description: "Fresh produce, meat, fish and staples" },
  { id: "cat-hardware", slug: "hardware", name: "Hardware", parent_id: null, sort_order: 14, description: "Cement, iron sheets, paints, electricals" },
];

function p(
  id: string,
  category_id: string,
  supplier_id: string | null,
  name: string,
  slug: string,
  short_description: string,
  detailed_description: string,
  price_kes: number,
  stock: number,
  towns: Town[],
): Product {
  return {
    id,
    category_id,
    supplier_id,
    name,
    slug,
    short_description,
    detailed_description,
    description: short_description,
    price_kes,
    // Seed catalog is already "live" — mirrors the production backfill
    // (039_product_markup.sql): explicit zero markup, not unreviewed, so
    // the demo storefront isn't suddenly empty.
    supplier_price_kes: price_kes,
    markup_type: "flat",
    markup_value: 0,
    stock,
    image_path: `/products/${slug}.jpg`,
    gallery: [
      `/products/${slug}-2.jpg`,
      `/products/${slug}-3.jpg`,
      `/products/${slug}-4.jpg`,
    ],
    barcode: null,
    towns,
    is_active: true,
    created_at: now,
  };
}

export const DEMO_PRODUCTS: Product[] = [
  p(
    "prod-1", "cat-laptops", "sup-1",
    "HP 15 Laptop 8GB/256GB", "hp-15-laptop",
    "Everyday laptop for school, office work, and browsing.",
    "The HP 15 is a dependable laptop for students and small businesses around Homabay and Mbita. It comes with 8GB RAM and a 256GB SSD for fast boot times, a full-size keyboard for typing notes or reports, and Wi‑Fi for online classes or M‑Pesa business tools. Ideal for Word, Excel, Zoom, and light design. Local warranty support available through AMG Online Store partner shops. Delivery by motorcycle within pilot towns.",
    52000, 12, ["Homabay", "Mbita"],
  ),
  p(
    "prod-2", "cat-laptops", "sup-1",
    "Wireless Mouse & Keyboard Combo", "wireless-mouse-keyboard",
    "Plug-and-play USB combo for desktops and laptops.",
    "This wireless mouse and keyboard set uses a single USB dongle, so you avoid cable clutter on shop counters or home desks. Soft keys reduce typing noise, and the mouse fits either hand. Compatible with Windows and most Linux setups. Batteries included. Perfect add-on when buying a laptop from AMG Online Store or upgrading an older PC.",
    2500, 40, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-3", "cat-phones", "sup-1",
    "Samsung A15 128GB", "samsung-a15",
    "Dual-SIM Android phone with strong battery for daily use.",
    "Samsung Galaxy A15 (128GB) gives you room for photos, WhatsApp, and school apps. Dual SIM lets you separate work and personal lines—useful for traders and boda operators. The display is bright outdoors, and the battery lasts a full day of calls and social media. Comes sealed with charger. Available for pickup or motorcycle delivery in Homabay and Mbita.",
    18500, 25, ["Homabay", "Mbita"],
  ),
  p(
    "prod-4", "cat-phones", "sup-1",
    "Type-C Fast Charger 25W", "type-c-fast-charger",
    "25W USB‑C wall charger for phones and small tablets.",
    "Charge compatible Android phones faster with this 25W USB‑C adapter. Compact for travel between Homabay, Mbita, and Migori. Includes cable. Built-in protection against overheating. Works with most modern Type‑C devices. Keep a spare at home and another at the shop.",
    1200, 80, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-5", "cat-printers", "sup-1",
    "Epson EcoTank L3250", "epson-l3250",
    "Wi‑Fi ink-tank printer for home and small office.",
    "Epson EcoTank L3250 prints, scans, and copies without expensive cartridges—refillable ink tanks cut cost per page. Connect over Wi‑Fi from your phone or laptop. Great for school notes, receipts, and church or SACCO documents. Setup help available at our Homabay pilot shop. Ink starter bottles included.",
    28000, 6, ["Homabay"],
  ),
  p(
    "prod-6", "cat-appliances", "sup-1",
    "32\" Smart LED TV", "smart-led-tv-32",
    "HD smart TV with built-in streaming apps.",
    "Enjoy news, football, and YouTube on this 32-inch HD Smart LED TV. Connect to Wi‑Fi for Netflix and other apps, or use HDMI for a decoder. Slim design fits small sitting rooms and rental units. Energy-efficient LED panel. Delivery and basic wall-mount advice available in Homabay and Mbita.",
    22000, 10, ["Homabay", "Mbita"],
  ),
  p(
    "prod-7", "cat-appliances", "sup-1",
    "2-Burner Gas Cooker", "gas-cooker-2b",
    "Compact two-burner cooker for busy home kitchens.",
    "Cook ugali, sukuma, and tea side by side on this sturdy 2-burner gas cooker. Compact footprint suits small kitchens. Easy-clean enamel surface. Compatible with standard LPG cylinders used locally. Inspect hose and regulator regularly for safety. Available in Homabay and Migori.",
    8500, 15, ["Homabay", "Migori"],
  ),
  p(
    "prod-8", "cat-appliances", "sup-1",
    "Electric Iron Box", "electric-iron-box",
    "Steam iron with non-stick soleplate for daily clothes.",
    "Smooth shirts, school uniforms, and lesos quickly with this electric steam iron. Non-stick soleplate glides on cotton and polyester. Adjustable heat settings. Lightweight for everyday use. Ideal for homes, hotels, and laundry side businesses.",
    1800, 30, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-9", "cat-appliances", "sup-1",
    "Mini Fridge 90L", "mini-fridge-90l",
    "90L fridge for drinks, leftovers, and shop stock.",
    "This 90-litre mini fridge cools drinks, milk, and leftovers without taking a full kitchen. Quiet compressor suits bedrooms, offices, and dukas. Adjustable shelves. Runs on standard power. Limited stock in Homabay—order early for delivery.",
    24500, 5, ["Homabay"],
  ),
  p(
    "prod-10", "cat-fashion", null,
    "Men's Casual Shirt", "mens-casual-shirt",
    "Breathable cotton shirt in assorted colours.",
    "A smart-casual cotton shirt for church, market days, or office. Soft fabric for Lake Victoria heat. Assorted colours and regular sizes. Easy to wash and iron. Pair with trousers from our fashion section. Confirm size on delivery if unsure.",
    1500, 50, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-11", "cat-fashion", null,
    "Ladies Ankara Dress", "ladies-ankara-dress",
    "Vibrant Ankara print dress for events and everyday wear.",
    "Stand out in a colourful Ankara dress tailored for comfort. Suitable for weddings, sundays, and celebrations. Soft lining feel with room to move. Assorted prints—message us after order if you prefer a specific colour family. Available in Homabay and Mbita.",
    2200, 35, ["Homabay", "Mbita"],
  ),
  p(
    "prod-12", "cat-beauty", null,
    "Shea Butter Body Lotion 400ml", "shea-body-lotion",
    "Daily moisturising lotion enriched with shea butter.",
    "Nourish dry skin with this 400ml shea butter body lotion. Absorbs well without sticky residue—good after bathing or farming outdoors. Mild scent. Suitable for family use. Store away from direct sun. Fast-moving beauty item across all pilot towns.",
    650, 60, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-13", "cat-furniture", null,
    "Plastic Armchair", "plastic-armchair",
    "Durable chair for indoor or outdoor seating.",
    "Stackable plastic armchair for homes, events, and waiting areas. Weather-resistant for verandas. Easy to wipe clean. Light enough to move, strong enough for daily use. Sold as single units—order multiples for halls or meetings.",
    1200, 40, ["Homabay", "Migori"],
  ),
  p(
    "prod-14", "cat-furniture", null,
    "4ft Wooden Coffee Table", "wooden-coffee-table",
    "Solid wood coffee table for living rooms.",
    "Anchor your sitting room with this 4ft wooden coffee table. Smooth finish for cups, remotes, and décor. Sturdy legs for uneven floors common in many homes. Wipe with a dry cloth. Delivery includes careful handling within Homabay.",
    6500, 8, ["Homabay"],
  ),
  p(
    "prod-15", "cat-decor", null,
    "Wall Mirror with Frame", "wall-mirror-frame",
    "Decorative framed mirror for bedrooms and hallways.",
    "Brighten a room and check your outfit with this framed wall mirror. Suitable for bedrooms, salons, and guest rooms. Includes hanging hardware guidance. Glass is packed for safe motorcycle delivery. Available in Homabay and Mbita.",
    2800, 14, ["Homabay", "Mbita"],
  ),
  p(
    "prod-16", "cat-farm-tools", "sup-3",
    "Jembe (Hoe)", "jembe-hoe",
    "Heavy-duty hoe for shambas and kitchen gardens.",
    "Classic jembe for digging, weeding, and planting. Strong metal blade with wooden handle. Built for daily farm work around Homabay, Mbita, and Migori. Check handle fit on receipt. Bulk orders welcome for groups and schools.",
    800, 100, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-17", "cat-farm-tools", "sup-3",
    "Knapsack Sprayer 16L", "knapsack-sprayer",
    "16L manual sprayer for crops and compounds.",
    "Apply pesticides, herbicides, or foliar feed evenly with this 16-litre knapsack sprayer. Adjustable nozzle, padded straps for long walks across shambas. Rinse thoroughly after chemical use. Training tip sheets available on request from Migori Hardware Hub partners.",
    3500, 20, ["Homabay", "Migori"],
  ),
  p(
    "prod-18", "cat-beddings", null,
    "Cotton Bedsheet Set (6x6)", "cotton-bedsheet-6x6",
    "6x6 cotton set with duvet cover and pillowcases.",
    "Refresh your bed with a soft cotton 6x6 sheet set. Includes fitted/flat sheet style pack, duvet cover, and pillowcases (as packed). Assorted prints. Machine washable. Ideal wedding or house-warming gift. Stocked for Homabay and Mbita delivery.",
    3200, 22, ["Homabay", "Mbita"],
  ),
  p(
    "prod-19", "cat-kitchen", null,
    "Stainless Cooking Pot Set (5pc)", "cooking-pot-set",
    "Five-piece stainless pot set for everyday cooking.",
    "Cook stews, githeri, and rice in this durable 5-piece stainless steel pot set. Even heat distribution, lids included. Easy to clean after oily meals. Nested storage saves space. A staple set for new homes and busy kitchens.",
    4500, 18, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-20", "cat-toys", null,
    "Kids Learning Tablet Toy", "kids-learning-tablet",
    "Educational toy tablet with lights, sounds, and letters.",
    "Keep children learning through play with this interactive tablet toy. Introduces letters, numbers, and music. Bright screen-style panel (toy electronics—not a real tablet). Ages 3+. Requires batteries (may be sold separately). Great gift for birthdays.",
    1800, 25, ["Homabay", "Mbita"],
  ),
  p(
    "prod-21", "cat-sport", null,
    "Football Size 5", "football-size-5",
    "Size 5 match ball for training and school games.",
    "Official size 5 football for academies, schools, and estate matches. Durable outer for dusty pitches. Pump separately if needed. Encourages youth sports across Homabay, Mbita, and Migori. Bulk pricing for clubs—contact AMG Online Store after order.",
    1500, 30, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-22", "cat-books", null,
    "KCPE Revision Bundle", "kcpe-revision-bundle",
    "Core subject revision pack for KCPE candidates.",
    "Prepare for KCPE with this revision bundle covering key primary subjects. Practice questions and notes aligned to the curriculum. Suitable for candidates and holiday coaching. Encourage daily timed practice. Delivered sealed across pilot towns.",
    2400, 40, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-23", "cat-agri", "sup-2",
    "Fresh Eggs (Tray of 30)", "fresh-eggs-tray",
    "Farm-fresh eggs, tray of 30 from local suppliers.",
    "Thirty fresh eggs sourced via Ruma Fresh Farms partners. Ideal for homes, hotels, and dukas. Handle gently on delivery—motorcycle riders pack with care. Best used within the week; refrigerate if possible. Order cut-off may apply for same-day Mbita/Homabay runs.",
    550, 80, ["Homabay", "Mbita"],
  ),
  p(
    "prod-24", "cat-agri", "sup-2",
    "Tilapia Fish (1kg)", "tilapia-1kg",
    "Fresh lake tilapia, about 1kg, cleaned on request.",
    "Enjoy Lake Victoria tilapia sold by the kilo. Request cleaning/gutting in the order notes. Same-day freshness focus for Mbita and Homabay. Cook fried, wet fry, or stew. Keep cool after delivery. Price may vary slightly with fish size—we confirm before dispatch if needed.",
    450, 50, ["Mbita", "Homabay"],
  ),
  p(
    "prod-25", "cat-agri", "sup-2",
    "Maize Flour 2kg", "maize-flour-2kg",
    "Fine sifted maize flour for ugali and porridge.",
    "2kg pack of fine sifted maize flour for soft ugali and porridge. Store in a dry place away from weevils. Popular household staple. Available across Homabay, Mbita, and Migori with regular restocks.",
    220, 120, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-26", "cat-agri", "sup-2",
    "Green Grams 1kg", "green-grams-1kg",
    "Dry ndengu (green grams), 1kg pack.",
    "Clean dry green grams for stews and githeri mixes. 1kg pack. Sort and rinse before cooking. Protein-rich and budget-friendly. Store sealed. Homabay and Migori delivery windows.",
    280, 70, ["Homabay", "Migori"],
  ),
  p(
    "prod-27", "cat-agri", "sup-2",
    "Ripe Bananas (Bunch)", "ripe-bananas-bunch",
    "Sweet ripe bananas sold per bunch.",
    "Ready-to-eat ripe bananas for snacking and kids’ lunchboxes. Bunch size varies with harvest—we aim for a fair market bunch. Best ordered for same-day or next-day delivery to keep firmness. Homabay and Mbita routes.",
    150, 60, ["Homabay", "Mbita"],
  ),
  p(
    "prod-28", "cat-hardware", "sup-3",
    "Cement 50kg Bag", "cement-50kg",
    "Portland cement, 50kg bag for building works.",
    "Standard 50kg Portland cement for foundations, plaster, and block work. Keep dry until use. Heavy item—delivery may use reinforced packing or pickup from Migori/Homabay points. Confirm site access for motorcycle vs. arranged drop.",
    950, 200, ["Homabay", "Migori"],
  ),
  p(
    "prod-29", "cat-hardware", "sup-3",
    "Iron Sheet Gauge 28 (3m)", "iron-sheet-28",
    "3m corrugated iron sheet, gauge 28.",
    "Gauge 28 corrugated iron sheet (3m) for roofing and sheds. Check colour/finish options when ordering. Edges are sharp—handle with gloves. Bundled carefully for transport. Available across Homabay, Mbita, and Migori.",
    1200, 90, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-30", "cat-hardware", "sup-3",
    "Emulsion Paint 4L", "emulsion-paint-4l",
    "4-litre interior emulsion paint, white.",
    "Refresh walls with 4L white emulsion paint for interior rooms. Good coverage on plastered surfaces. Stir well; apply with roller or brush. Allow drying between coats. Clean tools with water while wet. Homabay and Migori stock.",
    1800, 35, ["Homabay", "Migori"],
  ),
  p(
    "prod-31", "cat-hardware", "sup-3",
    "Steel Nails 1kg (Assorted)", "steel-nails-1kg",
    "1kg mixed steel nails for timber and roofing work.",
    "Assorted steel nails covering common sizes for timber framing, formwork, and general repairs. Sold by the kilo. Store dry to avoid rust. A basic stock item for any building-materials order alongside cement and timber.",
    250, 150, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-32", "cat-hardware", "sup-3",
    "River Sand (Ton)", "river-sand-ton",
    "One ton of river sand for concrete and plastering.",
    "Clean river sand sold per ton for concrete mixing, plastering, and blockwork. Delivery is arranged separately from motorcycle routes due to weight — AMG confirms a truck drop-off window after order. Available across all three pilot towns.",
    3500, 40, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-33", "cat-hardware", "sup-3",
    "Ballast (Ton)", "ballast-ton",
    "One ton of crushed stone ballast for foundations.",
    "Crushed stone ballast sold per ton, used for foundations and concrete works. Heavy item — truck delivery arranged after order confirmation, same as sand and cement bulk orders. Migori and Homabay stock, deliverable to Mbita on request.",
    4200, 30, ["Homabay", "Migori"],
  ),
  p(
    "prod-34", "cat-hardware", "sup-3",
    "Timber 2x3 (12ft)", "timber-2x3-12ft",
    "12ft sawn timber, 2x3 inch, for framing and roofing.",
    "Sawn 2x3 inch timber, 12 feet long, for roof trusses, formwork, and general construction framing. Check straightness on delivery. Sold per piece — order the quantity your fundi recommends for your roof size.",
    450, 200, ["Homabay", "Mbita", "Migori"],
  ),
  p(
    "prod-35", "cat-hardware", "sup-3",
    "PVC Water Pipe 1\" (3m)", "pvc-pipe-1-inch-3m",
    "3m PVC pressure pipe, 1 inch, for water plumbing.",
    "1-inch PVC pressure pipe, 3 metres, for household water supply lines. Pair with matching fittings and solvent cement (ask AMG for a fundi contact if needed). Sold per length.",
    650, 120, ["Homabay", "Migori"],
  ),
  p(
    "prod-36", "cat-hardware", "sup-3",
    "Electrical Wire 2.5mm (100m Roll)", "electrical-wire-2-5mm-100m",
    "100m roll of 2.5mm² copper electrical cable.",
    "2.5mm² single-core copper cable, 100m roll, for household electrical wiring (sockets and lighting circuits). Confirm colour (live/neutral/earth) needed. Have a qualified electrician handle installation.",
    6800, 25, ["Homabay", "Mbita", "Migori"],
  ),
].map((product) =>
  // No standalone product photos shot for these newer hardware SKUs yet —
  // reuse the Cement 50kg jobsite photo set rather than ship a broken image.
  ["prod-31", "prod-32", "prod-33", "prod-34", "prod-35", "prod-36"].includes(product.id)
    ? {
        ...product,
        image_path: "/products/cement-50kg.jpg",
        gallery: ["/products/cement-50kg-2.jpg", "/products/cement-50kg-3.jpg", "/products/cement-50kg-4.jpg"],
      }
    : product,
);

const TOWN_RIDER: Record<Town, { id: string; name: string }> = {
  Nairobi: { id: "rider-4", name: "Peter Kamau" },
  Mombasa: { id: "rider-5", name: "Amina Salim" },
  Kisumu: { id: "rider-6", name: "Dennis Owino" },
  Homabay: { id: "rider-1", name: "Brian Otieno" },
  Mbita: { id: "rider-2", name: "Faith Anyango" },
  Migori: { id: "rider-3", name: "Kevin Omondi" },
};

function demoOrder(
  id: string,
  customer_name: string,
  phone: string,
  town: Town,
  payment_method: Order["payment_method"],
  status: Order["status"],
  created_at: string,
  lines: {
    product_id: string;
    name_snapshot: string;
    price_kes: number;
    qty: number;
    supplier_id: string | null;
    supplier_name_snapshot: string | null;
  }[],
  deliveryMethod: Order["delivery_method"] = "doorstep",
): Order {
  const items = lines.map((line, i) => ({
    id: `${id}-i${i}`,
    order_id: id,
    ...line,
  }));
  const subtotal_kes = items.reduce((s, i) => s + i.price_kes * i.qty, 0);
  // Seed history assumes M-Pesa orders paid online upfront (auto discount);
  // COD orders pay the courier on arrival, so no discount applies.
  const paid = payment_method === "mpesa" && status !== "cancelled";
  const discount_kes = paid ? Math.round(subtotal_kes * 0.05) : 0;
  const dispatched =
    status === "out_for_delivery" || status === "delivered";
  const dropoff =
    deliveryMethod === "dropoff" ? DEMO_DROPOFF_POINTS.find((d) => d.town === town) : null;

  return {
    id,
    user_id: "demo-customer",
    customer_name,
    phone,
    town,
    address: `${town} delivery point`,
    payment_method,
    mpesa_phone: payment_method === "mpesa" ? phone : null,
    paid,
    paid_at: paid ? created_at : null,
    subtotal_kes,
    discount_kes,
    delivery_method: deliveryMethod,
    dropoff_point_id: dropoff?.id ?? null,
    dropoff_point_name: dropoff?.name ?? null,
    rider_id: dispatched ? TOWN_RIDER[town].id : null,
    rider_name_snapshot: dispatched ? TOWN_RIDER[town].name : null,
    delivered_at: status === "delivered" ? created_at : null,
    status,
    total_kes: subtotal_kes - discount_kes,
    created_at,
    buyer_notified_at:
      status === "confirmed" ||
      status === "out_for_delivery" ||
      status === "delivered"
        ? created_at
        : null,
    items,
  };
}

export const DEMO_ORDERS: Order[] = [
  demoOrder(
    "ord-1001",
    "Achieng Otieno",
    "0712345678",
    "Mbita",
    "mpesa",
    "pending",
    "2026-07-20T09:30:00.000Z",
    [
      {
        product_id: "prod-3",
        name_snapshot: "Samsung A15 128GB",
        price_kes: 18500,
        qty: 1,
        supplier_id: "sup-1",
        supplier_name_snapshot: "Lakeview Electronics",
      },
      {
        product_id: "prod-23",
        name_snapshot: "Fresh Eggs (Tray of 30)",
        price_kes: 550,
        qty: 1,
        supplier_id: "sup-2",
        supplier_name_snapshot: "Ruma Fresh Farms",
      },
    ],
  ),
  demoOrder(
    "ord-1002",
    "Peter Ouma",
    "0722111222",
    "Homabay",
    "cod",
    "delivered",
    "2026-07-18T11:00:00.000Z",
    [
      {
        product_id: "prod-28",
        name_snapshot: "Cement 50kg Bag",
        price_kes: 950,
        qty: 10,
        supplier_id: "sup-3",
        supplier_name_snapshot: "Migori Hardware Hub",
      },
      {
        product_id: "prod-29",
        name_snapshot: "Iron Sheet Gauge 28 (3m)",
        price_kes: 1200,
        qty: 8,
        supplier_id: "sup-3",
        supplier_name_snapshot: "Migori Hardware Hub",
      },
    ],
    "dropoff",
  ),
  demoOrder(
    "ord-1003",
    "Grace Akinyi",
    "0700555444",
    "Homabay",
    "mpesa",
    "out_for_delivery",
    "2026-07-22T14:15:00.000Z",
    [
      {
        product_id: "prod-6",
        name_snapshot: '32" Smart LED TV',
        price_kes: 22000,
        qty: 1,
        supplier_id: "sup-1",
        supplier_name_snapshot: "Lakeview Electronics",
      },
    ],
  ),
  demoOrder(
    "ord-1004",
    "John Odhiambo",
    "0711999888",
    "Migori",
    "cod",
    "confirmed",
    "2026-07-23T08:40:00.000Z",
    [
      {
        product_id: "prod-16",
        name_snapshot: "Jembe (Hoe)",
        price_kes: 800,
        qty: 4,
        supplier_id: "sup-3",
        supplier_name_snapshot: "Migori Hardware Hub",
      },
      {
        product_id: "prod-25",
        name_snapshot: "Maize Flour 2kg",
        price_kes: 220,
        qty: 5,
        supplier_id: "sup-2",
        supplier_name_snapshot: "Ruma Fresh Farms",
      },
    ],
  ),
  demoOrder(
    "ord-1005",
    "Mercy Atieno",
    "0744222333",
    "Mbita",
    "mpesa",
    "delivered",
    "2026-07-15T16:20:00.000Z",
    [
      {
        product_id: "prod-11",
        name_snapshot: "Ladies Ankara Dress",
        price_kes: 2200,
        qty: 2,
        supplier_id: null,
        supplier_name_snapshot: null,
      },
      {
        product_id: "prod-12",
        name_snapshot: "Shea Butter Body Lotion 400ml",
        price_kes: 650,
        qty: 3,
        supplier_id: null,
        supplier_name_snapshot: null,
      },
    ],
    "dropoff",
  ),
  demoOrder(
    "ord-1006",
    "Samuel Okoth",
    "0799000111",
    "Homabay",
    "mpesa",
    "cancelled",
    "2026-07-21T10:05:00.000Z",
    [
      {
        product_id: "prod-1",
        name_snapshot: "HP 15 Laptop 8GB/256GB",
        price_kes: 52000,
        qty: 1,
        supplier_id: "sup-1",
        supplier_name_snapshot: "Lakeview Electronics",
      },
    ],
  ),
  demoOrder(
    "ord-1007",
    "Faith Adhiambo",
    "0717000888",
    "Migori",
    "cod",
    "awaiting_supplier",
    "2026-07-24T12:00:00.000Z",
    [
      {
        product_id: "prod-30",
        name_snapshot: "Emulsion Paint 4L",
        price_kes: 1800,
        qty: 6,
        supplier_id: "sup-3",
        supplier_name_snapshot: "Migori Hardware Hub",
      },
    ],
  ),
];
