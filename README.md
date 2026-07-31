# AMG.COM Marketplace

Full marketplace for **AMG.COM** — targeting locals in Homabay & Migori Counties, with pilot shops in Homabay and Mbita.

Stack: **Next.js (App Router)**, **Tailwind CSS**, **Supabase** (Auth, Postgres, Storage). Demo mode runs without Supabase.

## Features

- Brand-led storefront with category browse, search, and town filters
- Product detail, cart, checkout — Cash on Delivery, or **pay now with M-Pesa for an automatic 5% discount**
- Choice of delivery: motorcycle to the buyer's doorstep, or pickup from a named **drop-off point**
- **Instant quotes** for building materials — buyer lists what they need, gets priced against the hardware catalogue immediately, converts matched items straight to an order
- **Order tracking** with a live status timeline, in-app notifications, SMS, and email at every step
- **Rider portal** — riders see assigned deliveries, mark them delivered, and get paid a per-delivery commission with a push notification
- Customer accounts and order history
- Admin console: dashboard, products, orders workflow, quotes, suppliers, categories, riders
- Admin reports: overview, financial, sales, products, logistics, payments, quotes, riders — with trend charts, CSV export, and date-range presets
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
| Rider    | `brian@amg.com`     | `rider123`     |
| Rider    | `faith@amg.com`     | `rider123`     |
| Rider    | `kevin@amg.com`     | `rider123`     |

### Pay now with M-Pesa — 5% discount
At checkout, choosing **Pay now with M-Pesa** triggers an STK-push-style confirmation. Once confirmed, AMG automatically deducts 5% from the order total (`PAY_NOW_DISCOUNT_RATE` in `src/lib/format.ts`). Cash on delivery orders are unaffected. The discount is marketed on the homepage, the storefront trust strip, and reinforced at checkout. See **M-Pesa (Daraja)** below for how the real payment path activates.

### Instant building-materials quotes
`/quote` lets a buyer list materials in plain language (qty + unit); `src/lib/quotes.ts` matches each line against the **Hardware** category by token overlap and returns an itemized price instantly — no waiting on a human for common items. Unmatched items are flagged for a follow-up call and logged for admin under **Admin → Quotes**. Matched items can be converted straight into a cart/checkout.

### Delivery: doorstep or drop-off point
Checkout offers **Deliver to my doorstep** (motorcycle to the buyer) or **Deliver to a drop-off point** (pickup from a named AMG collection point, seeded per town in `src/lib/demo-data.ts` / `supabase/seed.sql`). The choice follows the order through admin, the rider portal, and the tracking page.

### Order → supplier → buyer → rider flow
1. Customer places an order (status **Pending**), optionally paying online for the 5% discount.
2. Admin opens **Orders**, sees which supplier owns each line (shoppers never see supplier names).
3. Admin clicks **Order from [Supplier]** — supplier gets an in-app notification.
4. Supplier opens **Supplier portal → Supply requests**, reviews items/total for the AMG client, and **confirms**.
5. Admin sees **Supplier confirmed**, then clicks **Confirm order to buyer** (buyer gets in-app notification + SMS + email).
6. Admin picks a **rider** for the order's town and clicks **Dispatch with rider** — rider gets an in-app notification of the new delivery; buyer gets **out for delivery** notifications.
7. Rider opens the **Rider portal**, and once they've handed the order over, clicks **Mark delivered — arrived at drop point**. This pays the rider a flat commission (`RIDER_PAYOUT_KES` in `src/lib/format.ts`), pushes a "payment sent" alert to their device (falls back to in-app if push isn't enabled/configured), and notifies the buyer the order is delivered.

### Order tracking & notifications
`/order/[id]` is a live tracker (polls every few seconds) with a visual step timeline — Order placed → Confirmed → Out for delivery → Delivered. Every account holder (customer, admin, supplier, rider) gets a notification bell in their header showing in-app updates. SMS and email fire on the same status changes — see **Twilio SMS** and **Email** below for activating real delivery.

`.env.local` ships with `NEXT_PUBLIC_DEMO_MODE=true` so the app uses local seed data and `localStorage` for carts/orders.

## Supabase setup (production)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy `.env.example` → `.env.local` and set:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_DEMO_MODE=false
```

3. In the Supabase SQL editor, run every file under `supabase/migrations/` **in order** (001 → 011), then `supabase/seed.sql`:
   - `001_schema.sql` — core schema (profiles, categories, products, orders)
   - `002_product_details_gallery.sql`, `003_product_barcode.sql` — product detail fields
   - `004_supplier_workflow.sql` — supplier role + supply requests + notifications
   - `005_order_place_rls.sql` — guest checkout RLS fix
   - `006_google_oauth_profile.sql` — Google OAuth profile names
   - `007_payment_delivery_riders.sql` — pay-now/discount fields, doorstep vs drop-off, rider role, `riders` + `dropoff_points` tables
   - `008_rider_payouts.sql` — `rider_payouts` table + `mark_order_delivered()` RPC
   - `009_quote_requests.sql` — `quote_requests` table + guest-safe fetch RPC
   - `010_push_subscriptions.sql` — `push_subscriptions` table (Web Push)
   - `011_order_confirmation_v2.sql` — extends the guest order-confirmation RPC with the new fields
   - `seed.sql`
4. Auth → create a user (e.g. `admin@amg.com`), then promote:

```sql
update public.profiles set role = 'admin' where id = '<user-uuid>';
```

To create a rider login, create the auth user then:

```sql
update public.profiles set role = 'rider', rider_id = '<a riders.id from seed.sql>' where id = '<user-uuid>';
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
src/app/           Storefront, auth, admin, supplier, rider, and quote routes
src/app/api/       M-Pesa STK push, SMS, email, and push-notification routes
src/components/    Shop + admin + rider + notification UI
src/lib/           Supabase clients, demo store, cart/auth, reports, quotes, notifications
supabase/          SQL schema, RLS, seed data
```

## Deploy (DigitalOcean)

See **[DEPLOY.md](DEPLOY.md)** for App Platform (primary) and Droplet + Docker setup, env vars, domain/SSL, and Supabase reminders.

## Twilio SMS (optional)

When `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (or `TWILIO_MESSAGING_SERVICE_SID`) are set server-side, AMG sends an SMS to the order phone on **confirmed**, **out for delivery**, and **delivered**. Missing credentials or send errors are logged and never block status updates. See `.env.example` and [DEPLOY.md](DEPLOY.md).

## Email (optional)

When `RESEND_API_KEY` and `EMAIL_FROM` are set server-side, AMG emails the buyer at the same events as SMS, whenever they gave an email at checkout. Soft-fail like SMS — never blocks status updates.

## Web Push for riders (optional)

When `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` are set, riders can click **Enable payment alerts** in the rider portal to receive a real browser push notification when a delivery payout is sent. Without a subscription (or without VAPID configured), the in-app notification bell is always the guaranteed fallback — nothing is ever silently missed. Generate a keypair with `node -e "console.log(require('web-push').generateVAPIDKeys())"`.

## M-Pesa (Daraja) — real "pay now" checkout

Checkout's M-Pesa "pay now" step uses a real Daraja STK-push integration (`src/lib/mpesa/daraja.ts`) when `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, and a publicly reachable `MPESA_CALLBACK_URL` are all set. Without them, checkout falls back to an instant **simulated** confirmation (clearly labelled as such in the UI) so the flow always works in demo/dev. The Daraja callback lands on `/api/mpesa/callback`; the browser polls `/api/mpesa/status` while a real push is pending.

## Notes

- Guest cart lives in `localStorage` and works without login; signed-in users still place orders against their profile when available.
- Guest quote requests and orders both work without an account; sign in to see history under **My orders**.
