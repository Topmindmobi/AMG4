# AMG.COM Marketplace

Full marketplace for **AMG.COM** — targeting locals in Homabay & Migori Counties, with pilot shops in Homabay and Mbita.

Stack: **Next.js (App Router)**, **Tailwind CSS**, **Supabase** (Auth, Postgres, Storage). Demo mode runs without Supabase.

## Features

- Brand-led storefront with category browse, search, and town filters
- Product detail, cart, checkout (Cash on Delivery + M-Pesa phone capture)
- Customer accounts and order history
- Admin console: dashboard, products, orders workflow, suppliers, categories
- Seeded catalog from the AMG.COM blueprint (electronics, appliances, agri, hardware, and more)

## Quick start (demo mode)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Demo accounts:

| Role     | Email               | Password       |
|----------|---------------------|----------------|
| Admin    | `admin@amg.com`     | `admin123`     |
| Customer | `customer@amg.com`  | `customer123`  |
| Supplier | `lakeview@amg.com`  | `supplier123`  |
| Supplier | `ruma@amg.com`      | `supplier123`  |
| Supplier | `migori@amg.com`    | `supplier123`  |

### Admin reports
Open **Admin → Reports** for:
- Overview KPIs
- Financial (GMV, revenue, AOV, cancellations)
- Sales (status, towns, top products)
- Products (inventory value, category/supplier mix, low stock)
- Logistics (pipeline, towns, supplier fulfillment)
- Payments (COD vs M-Pesa)

Filter any report by date range.

### Order → supplier → buyer flow
1. Customer places an order (status **Pending**).
2. Admin opens **Orders**, sees which supplier owns each line (shoppers never see supplier names).
3. Admin clicks **Order from [Supplier]** — supplier gets an in-app notification.
4. Supplier opens **Supplier portal → Supply requests**, reviews items/total for the AMG client, and **confirms**.
5. Admin sees **Supplier confirmed**, then clicks **Confirm order to buyer** (buyer gets in-app + SMS when Twilio is configured).
6. Admin clicks **Dispatch (AMG delivery)** when ready to send (buyer SMS: out for delivery).

`.env.local` ships with `NEXT_PUBLIC_DEMO_MODE=true` so the app uses local seed data and `localStorage` for carts/orders.

## Supabase setup (production)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` → `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DEMO_MODE=false
```

3. In the Supabase SQL editor, run in order:
   - [`supabase/migrations/001_schema.sql`](supabase/migrations/001_schema.sql)
   - [`supabase/migrations/002_product_details_gallery.sql`](supabase/migrations/002_product_details_gallery.sql) (if present)
   - [`supabase/migrations/003_product_barcode.sql`](supabase/migrations/003_product_barcode.sql) (if present)
   - [`supabase/migrations/004_supplier_workflow.sql`](supabase/migrations/004_supplier_workflow.sql) (if present)
   - [`supabase/migrations/005_order_place_rls.sql`](supabase/migrations/005_order_place_rls.sql) (guest checkout confirmation RPC)
   - [`supabase/migrations/006_google_oauth_profile.sql`](supabase/migrations/006_google_oauth_profile.sql) (Google OAuth profile names)
   - [`supabase/seed.sql`](supabase/seed.sql)
4. Auth → create a user (e.g. `admin@amg.com`), then promote:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

5. **Google sign-in (optional):** Auth → Providers → Google → enable, then paste a Google Cloud OAuth **Web** Client ID and Secret. In Google Cloud, set Authorized redirect URI to `https://xavotkqffqucfndbrbid.supabase.co/auth/v1/callback`. In Supabase Auth → URL Configuration, add redirect URLs for `http://localhost:3000/**`, `http://localhost:3000/auth/callback`, and your live app (`https://amg-com-2j9zz.ondigitalocean.app/**` and `/auth/callback`).

6. Restart the app: `npm run dev`.

Product images upload to the `product-images` storage bucket (created by the migration).

## Scripts

| Command       | Description        |
|---------------|--------------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Start production  |
| `npm run lint` | ESLint             |

## Project layout

```
src/app/           Storefront, auth, admin routes
src/components/    Shop + admin UI
src/lib/           Supabase clients, demo store, cart/auth
supabase/          SQL schema, RLS, seed data
```

## Deploy (DigitalOcean)

See **[DEPLOY.md](DEPLOY.md)** for App Platform (primary) and Droplet + Docker setup, env vars, domain/SSL, and Supabase reminders.

## Twilio SMS (optional)

When `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`) are set server-side, AMG sends an SMS to the order phone on **Confirm order to buyer** (`confirmed`) and **Dispatch** (`out_for_delivery`). Missing credentials or send errors are logged and never block status updates. See `.env.example` and [DEPLOY.md](DEPLOY.md).

## Notes

- M-Pesa STK push is intentionally deferred; checkout records M-Pesa phone + amount for later Daraja integration.
- Guest cart lives in `localStorage` and works without login; signed-in users still place orders against their profile when available.
