# AMG Online Store (AMG.COM / AMG Stores) — Codebase Audit

Repo: `C:\Users\Frednj\Documents\AMG-2\AMG-2` (GitHub `Topmindmobi/AMG4`, branch `claude/marketplace-feature-expansion`)
Scope: static, read-only code inspection. No files modified.

---

## A. Current Architecture

- **Framework**: Next.js **16.2.11** (App Router), React **19.2.4** / react-dom 19.2.4, TypeScript **5** with `strict: true` (`tsconfig.json`). ESLint 9 + `eslint-config-next`.
- **Styling**: Tailwind CSS **v4** via `@tailwindcss/postcss` (`postcss.config.mjs`), no `tailwind.config` (v4 CSS-first config lives in `src/app/globals.css`). Utility classes only, no CSS-in-JS.
- **Backend**: Supabase — `@supabase/ssr ^0.12.3` + `@supabase/supabase-js ^2.110.8`. Postgres schema/RLS lives in `supabase/migrations/001_schema.sql` … `016_admin_deliver_override.sql` (16 migrations) plus `supabase/seed.sql`.
- **Other server deps**: `twilio` (SMS), `resend` (email), `web-push` (VAPID push), `html5-qrcode` (barcode scanning UI), `server-only` (compile-time server-code guard). No unused dependencies found — every package in `package.json` traces to real usage.
- **Routing**: App Router with plain top-level folders per role (`src/app/admin`, `/supplier`, `/rider`, `/account`, `/api/...`) — not Next's `(group)` route-group syntax, so the folder name doubles as the URL segment.
- **Middleware**: Next 16 has renamed `middleware.ts` to **`src/proxy.ts`** (`export async function proxy(...)`), which the app uses correctly for session-cookie refresh (`src/lib/supabase/middleware.ts:5-35`, called from `src/proxy.ts:4-6`). It does **not** do any role/path authorization — see Critical Problems #8.
- **Data-access pattern**: no repository/service layer. Supabase calls are made directly inside components — 70 files are `"use client"`, and 22 of them `import` `@/lib/supabase/client` directly (e.g. `src/app/admin/orders/page.tsx`, `src/app/checkout/page.tsx`, `src/lib/cart.tsx`). Server Components are used for layout shells only; almost all data fetching for protected pages happens client-side against Supabase with the public anon key, secured (in theory) entirely by RLS.
- **Demo mode**: `src/lib/supabase/config.ts` (`isDemoMode()`) toggles between real Supabase and an in-memory/localStorage simulation in `src/lib/store/demo-store.ts` (2,108 lines). Nearly every page branches `if (isDemoMode()) { ... } else { ... real Supabase ... }` — 22+ occurrences (e.g. `src/app/admin/orders/page.tsx:69,140,160,195,238`). Some features exist **only** in the demo branch (see Critical Problems #7).
- **Auth**: Supabase Auth (email/password + Google OAuth) plus a `profiles` table with a `role` enum (`customer|admin|supplier|rider`, added incrementally across migrations 001/004/007). Role state lives in a React context, `src/lib/auth-context.tsx`, fetched client-side after login. No server-side session/role check gates any route or API handler except `src/app/api/account/delete/route.ts`.
- **API design**: 13 Next.js route handlers under `src/app/api/**` (account, admin, auth, mpesa, orders, push). Mostly `POST`, JSON in/out, inconsistent error shapes (`{ ok, error }` vs `{ error }` vs thrown exceptions), and inconsistent auth (see Critical Problems #6, #9, #10).
- **State management**: React Context for auth (`auth-context.tsx`) and cart (`src/lib/cart.tsx`); no Redux/Zustand/Query library — Supabase results are held in local `useState`, refetched manually via a `load()`/`useEffect` pattern.
- **Offline support**: `src/lib/offline/order-queue.ts` + `src/lib/offline/db.ts` (IndexedDB) queue orders when offline and flush via the `online` event / Background Sync — a deliberate, well-considered feature for a market with unreliable connectivity.
- **Env config**: `.env.example` and `.env.droplet.example` are present and well-commented, documenting every variable (Supabase, Twilio, Resend, VAPID, M-Pesa Daraja) with safe fallbacks. `.env.local` in this checkout only sets `NEXT_PUBLIC_DEMO_MODE=` (no live credentials present locally). `.gitignore` correctly excludes all `.env*` except `.env.example`. Service-role key handling is isolated to `src/lib/supabase/admin.ts` behind `import "server-only"`.

---

## B. What Is Good

- **`src/app/api/account/delete/route.ts`** does the auth pattern correctly: it verifies the caller's own session server-side (`server.auth.getUser()`) before ever touching the service-role admin client, and only ever deletes the caller's own account. This is the model the other API routes should follow (see Critical Problems #6, #9, #10) — proof the team knows how to do this right when they do it.
- **The rider delivery state machine is genuinely well engineered**: `supabase/migrations/014_rider_kanban_production.sql` and `016_admin_deliver_override.sql` implement `set_rider_delivery_status()` as a `SECURITY DEFINER` RPC with a real forward-only transition map (`assigned → collected → in_transit → delivered → paid`, plus a `failed` branch and an explicit, narrowly-scoped admin override), proper `is_admin()`/`is_rider_of()` authorization inside the function, and row locking (`for update`). The migration comments document a real production bug ("Cannot move from assigned to delivered") and its considered fix — this is disciplined, iterative engineering, not a one-shot script.
- **`src/components/layout/DashboardShell.tsx`** is a well-abstracted shared shell for the three dashboard roles: proper mobile drawer semantics (`role="dialog"`, `aria-modal="true"`, `aria-label`, `aria-expanded`/`aria-controls` on the trigger), Escape-key close, body-scroll lock while open, and `aria-current="page"` on the active nav link. Good example of doing the accessible thing without being asked.
- **Responsive tables**: every wide `<table>` found in the codebase is wrapped in an `overflow-x-auto` container — `src/components/supplier/SupplierInventory.tsx:169`, `src/components/admin/reports/ReportUI.tsx:216`, `src/app/admin/products/page.tsx:57`, `src/app/supplier/products/page.tsx:49`, `src/components/supplier/ProductBulkImport.tsx:216`, `src/app/quote/page.tsx:264`. This is a common miss in similar apps and it isn't one here.
- **Kanban boards are click/tap-driven, not native drag-and-drop**: `src/components/supplier/SupplyKanban.tsx:253-254` explicitly disables `draggable`/`onDragStart` in favor of button-based stage transitions — a more accessible and mobile-friendly choice than a typical HTML5 DnD kanban.
- **No `any`/`as any` usage anywhere in `src/`** under `strict: true` — genuinely disciplined TypeScript for a codebase this size (142 `.ts(x)` files).
- **No unused dependencies** — `twilio`, `resend`, `web-push`, `html5-qrcode`, `server-only` are all exercised by real code; OpenAI is called via a raw `fetch` in the two AI-assist routes rather than pulling in an SDK dependency for two call sites.
- **RLS is enabled on essentially every table**, not just used opportunistically — even though the coverage has real gaps (Critical Problems), the intent and baseline discipline (enable RLS immediately when a table is created, write helper functions `is_admin()`/`is_supplier_of()`/`is_rider_of()` instead of duplicating `exists(...)` everywhere) is sound and reused consistently across all 16 migrations.
- **`.env.example`** is unusually thorough for a project this size — every variable is commented with what it's for, where to obtain it, and what happens if it's absent (falls back to simulated M-Pesa, demo mode, etc).

---

## C. Critical Problems (security / data-integrity / reliability)

1. **Client-controlled checkout pricing — no server-side price re-validation.**
   `src/app/checkout/page.tsx:184-238` builds `orderRow.total_kes` and each line item's `price_kes` from the client-side cart (`useCart()`), then `src/lib/offline/order-queue.ts:64-67` inserts them straight into Supabase from the browser (`supabase.from("orders").insert(orderRow)` / `.from("order_items").insert(lineItems)`). The RLS policies permitting this are `"Anyone can create orders" ... with check (true)` and `"Anyone can insert order items" ... with check (true)` (`supabase/migrations/001_schema.sql:184-186, 203-205`), reinforced by explicit grants to `anon, authenticated` in `supabase/migrations/005_order_place_rls.sql:64-65`. Nothing anywhere recomputes `price_kes`/`total_kes` from `products.price_kes` server-side. A customer can edit the cart price in devtools (or call the Supabase REST endpoint directly with the public anon key) and place a real order at an arbitrary price.

2. **`paid` status and M-Pesa amount are client-asserted, not server-verified.**
   `checkout/page.tsx:63,181,221` computes `paid` from local component state (`payState === "paid"`) and writes it directly into `orders.paid`. `src/app/api/mpesa/stk-push/route.ts:26-33` accepts a client-supplied `amountKes` with only a `> 0` check — it is never cross-checked against a server-computed order total. Combined with #1, a user can submit `paid: true` without ever completing (or even attempting) a real M-Pesa payment.

3. **Order creation is not atomic.**
   `order-queue.ts:64-67` performs the `orders` insert and the `order_items` insert as two separate sequential REST calls with no surrounding transaction/RPC. A failure between them (network drop, tab closed) leaves an order row with zero items, and RLS blocks reading guest orders back for cleanup (`005_order_place_rls.sql`'s own comment explains this exact RLS quirk).

4. **No stock/inventory enforcement at checkout.**
   `products.stock` exists with a `>= 0` check (`001_schema.sql:51`), but nothing in the checkout path (`checkout/page.tsx`, `order-queue.ts`) reads or decrements it. Concurrent orders can oversell the same stock; inventory is presumably managed manually by suppliers/admin after the fact.

5. **IDOR / PII exposure via `get_order_confirmation`.**
   `supabase/migrations/007_payment_delivery_riders.sql:10-59` defines a `SECURITY DEFINER` RPC granted to `anon, authenticated` (line 59) that returns an order's `customer_name`, `phone`, `address`, `mpesa_phone`, `total_kes`, and items for **any** order id, with no ownership check — the migration's own comment calls the UUID "an unguessable token," i.e. security-through-obscurity rather than access control. `src/app/order/[id]/page.tsx:51-54` calls this RPC unconditionally for whoever loads `/order/<id>`, so anyone who obtains an order link (referrer leakage, shared screenshot, browser history on a shared device) can read another customer's name, phone, and delivery address.

6. **Forgeable in-app notifications.**
   `supabase/migrations/004_supplier_workflow.sql:88-90`: `create policy "Admins insert notifications" on public.notifications for insert with check (public.is_admin() or true);` — the `or true` makes this policy pass unconditionally. Any authenticated caller can insert a notification for **any** `user_id` with arbitrary `title`/`body`/`link`, effectively allowing in-app phishing/spoofing of order or payment alerts to any other user (surfaced via `src/components/notifications/NotificationBell.tsx:59`, which does `router.push(note.link)` on click).

7. **The core supplier order-routing workflow does not work in production at all.**
   `src/app/admin/orders/page.tsx:135-148` (`confirmSupplierOrder`) throws `"Supplier workflow requires demo mode or Supabase RPCs."` whenever `isDemoMode()` is false. `src/app/supplier/requests/page.tsx` (the supplier's entire order pipeline / `SupplyKanban`) calls **only** `getDemoSupplyRequests`/`confirmDemoSupplyRequest`/`dispatchDemoSupplyRequest` from `demo-store.ts` — there is no `isDemoMode()` branch at all, so it always uses in-memory demo data even against a real Supabase backend. This is corroborated by the codebase's own migration comment in `supabase/migrations/016_admin_deliver_override.sql:9-17`: "the supplier-sourcing steps... had no production path anywhere... `/supplier/requests`... is a separate, still demo-only page (suppliers can't yet see or confirm these requests in production)." In production, admins cannot route an order to a supplier and suppliers cannot see or confirm supply requests — a core marketplace feature is effectively absent outside demo mode.

8. **No server-side authorization boundary — role gating is client-side only.**
   `src/components/admin/AdminShell.tsx:42-56`, `src/components/supplier/SupplierShell.tsx:40-55`, and `src/components/rider/RiderShell.tsx:29-43` each gate access with a `useEffect` that reads `useAuth()` (a client-fetched profile) and `router.replace()`s away if the role doesn't match. `src/proxy.ts` (the app's only middleware) exclusively refreshes the Supabase session cookie (`src/lib/supabase/middleware.ts:5-35`) — it performs no role or route check. This means Postgres RLS is the *only* real security boundary in the app; when an RLS policy is wrong or missing (as in #1, #5, #6), there is no second line of defense at the application layer.

9. **Unauthenticated, cost-incurring notification endpoints.**
   `src/app/api/orders/sms/route.ts:23-51` accepts an arbitrary `{ orderId, phone, event }` from any caller with no auth/session check and sends a real Twilio SMS (`sendOrderStatusSms`); `src/app/api/orders/email/route.ts` follows the same pattern for Resend email. Both are abusable to spam arbitrary phone numbers/inboxes on AMG's paid Twilio/Resend accounts. `src/app/api/push/subscribe/route.ts:13-51` accepts a client-supplied `userId` with no check that it matches the caller's actual session, and `upsert`s the caller's push endpoint under it — an attacker can register their own device under another user's `userId`, redirecting that user's future push notifications (order dispatch, rider payout alerts) to themselves.

10. **Unauthenticated internal AI endpoints under `/api/admin/`.**
    `src/app/api/admin/select-supplier/route.ts` and `src/app/api/admin/analyze-quote/route.ts` have no auth check despite living under `/api/admin/` — any unauthenticated caller can invoke them, consuming `OPENAI_API_KEY` credits on every call.

11. **Product image upload has no size/type validation.**
    `src/components/admin/ProductForm.tsx:114-124` (cover image) and `:126-140` (gallery) upload directly to `supabase.storage.from("product-images").upload(...)` with no client- or app-level file-size cap and no MIME/extension allow-list beyond the HTML `accept="image/*"` attribute (`ProductForm.tsx:235`), which is a UI hint only and trivially bypassed by any client that isn't the browser file picker (e.g. a direct API call). Storage RLS (`001_schema.sql:220-230`) does correctly restrict who can write to the bucket (admins, and — via `004_supplier_workflow.sql:93-105` — suppliers editing their own products' `products.image_path`/`gallery` columns directly, which is not itself validated as a real storage path).

---

## D. UX/UI Problems

- **Permanently dead nav items shown to real users.** `src/components/rider/RiderShell.tsx:15-16,22-23` lists "Route map," "Remittance," "History," and "Earnings" as `comingSoon: true` nav entries that riders will see in every session with no ETA or explanation — half the rider's own account section is a dead end.
- **Bare-text loading/auth-check states, no skeleton.** `AdminShell.tsx:58-64`, `SupplierShell.tsx:62-68`, `RiderShell.tsx:45-51` all render a plain `"Checking admin/supplier/rider access…"` string on a flat background instead of any skeleton/spinner consistent with the rest of the styled UI — jarring flash on every protected-page load.
- **Admin order-status control has no guardrails.** `src/app/admin/orders/page.tsx:507-529` is a raw `<select>` that lets an admin jump an order to *any* status, including illegal/backward transitions (e.g. `delivered → pending`), with no confirmation dialog and no transition validation — a stark contrast to the carefully validated rider delivery state machine (`set_rider_delivery_status`) built for the same domain.
- **Guest checkout's temporary-password recovery path is fragile.** `checkout/page.tsx:126-168` creates a temporary account and stashes the generated password client-side (`stashAccountCreatedNotice`) for display on the confirmation page only; if the user closes the tab before that page renders, the in-app UI has no fallback recovery flow shown to the user beyond whatever async email/SMS is sent.

---

## E. Responsiveness Problems

Overall this is a strong point of the codebase (see section B), with one caveat:

- **Wide tables still force a hard minimum width inside their scroll wrapper**, e.g. `min-w-[720px]` (`SupplierInventory.tsx:170`), `min-w-[640px]` (`admin/products/page.tsx:58`, `ProductBulkImport.tsx:217`), `min-w-[560px]` (`supplier/products/page.tsx:50`), `min-w-[480px]` (`ReportUI.tsx:217`, `quote/page.tsx:265`). Because they're wrapped in `overflow-x-auto` this doesn't break layout, but on a small phone the user must scroll horizontally to read every row of every admin/supplier table — no responsive "stack into cards below 480px" alternative was attempted anywhere, which would read noticeably better on the low/mid-range Android devices common in the target market.

---

## F. Code Quality Problems

- **`src/lib/store/demo-store.ts` is a 2,108-line "god file"** mixing demo authentication (including a literal in-file plaintext password map, `demo-store.ts:130-137`), orders, notifications, supply requests, rider payouts, and quotes, with no internal module boundaries. It duplicates the shape of the real Supabase logic without sharing any code with it, which is the direct cause of Critical Problem #7 (a whole feature silently existing in only one of the two code paths).
- **Three near-identical role-shell components.** `AdminShell.tsx`, `SupplierShell.tsx`, and `RiderShell.tsx` each re-implement the same auth-guard `useEffect` (redirect-if-no-user, redirect-if-wrong-role), the same `"Checking … access…"` fallback, and the same "initials from `full_name`" computation (`AdminShell.tsx:47-56,66-71`; `SupplierShell.tsx:46-55,71-76`; `RiderShell.tsx:34-43,53-58`) — a textbook case for a shared `useRoleGuard(role)` hook and a shared avatar/footer component.
- **The demo/production branch is duplicated in every single data-fetching page** rather than hidden behind one data-access interface — 22+ occurrences of `if (isDemoMode()) { ... } else { const { createClient } = await import("@/lib/supabase/client"); ... }` (e.g. `admin/orders/page.tsx:69-99`, `checkout/page.tsx:129-168,194-274`). Every feature effectively has to be built and tested twice, and — as #7 shows — it's easy for one branch to simply be forgotten.
- **Inconsistent rigor for conceptually identical problems.** The rider delivery status machine is validated server-side with a real transition graph (`set_rider_delivery_status`), while the general admin order-status `<select>` (`admin/orders/page.tsx:507-529`) has none — same underlying problem (order state machine), two very different quality bars within the same app.
- **No pagination anywhere** (`.range()`/`.limit()` do not appear on any Supabase query in `src/`) — a design gap as much as a performance one; the code was not written with future data growth in mind.

---

## G. Branding Cleanup

**Literal "AMG.COM" (old dot-com brand form) remaining in the repo:**

| File | Line(s) | Note |
|---|---|---|
| `supabase/migrations/001_schema.sql` | 1 | `-- AMG.COM marketplace schema` — comment only, historical migration file, not executed as user-facing text. |
| `supabase/migrations/008_rider_payouts.sql` | 87–88 | Original notification copy `'Your AMG.COM order was delivered'` / `'...Asante for shopping with AMG.COM!'`. **Superseded** by `013_amg_stores_branding.sql`, which re-creates the same function (`mark_order_delivered`) with the copy changed to "AMG Stores" (see `013_amg_stores_branding.sql:57-58`). On any database with migrations applied in order, the *live* function already says "AMG Stores" — the "AMG.COM" string only survives in migration history, not in current runtime behavior. Still worth squashing/annotating for future readers of migration history. |
| `supabase/migrations/013_amg_stores_branding.sql` | 1 | Comment referencing the old name for context — not itself a leftover. |

**No occurrence of literal "AMG.COM" was found in any currently-rendered `src/` UI/copy.** The four files the prior grep flagged (`src/app/contact/page.tsx`, `src/app/auth/login/page.tsx`, `src/lib/store/demo-store.ts`, `src/lib/push/send.ts`) all currently contain `@amg.com` **email addresses**, not the "AMG.COM" brand string — listed separately below since they're a related but distinct cleanup item.

**Important context: the app has already been substantially rebranded once, to "AMG Stores"** (not yet to "AMG Online Store," the task's stated target). Every live, user-facing string below currently says "AMG Stores":

- `src/app/layout.tsx:41` — `title: "AMG Stores — Kenya's Nationwide Marketplace"`
- `src/app/layout.tsx:48` — `title: "AMG Stores"` (OG/social metadata)
- `public/manifest.json:2-3` — PWA `"name"` and `"short_name"` both `"AMG Stores"` / `"AMG Stores — Kenya's Nationwide Marketplace"`
- `src/app/about/page.tsx:5,7,16,18`
- `src/app/contact/page.tsx:5,7`
- `src/components/shop/SiteHeader.tsx:71` — `aria-label="AMG Stores home"`
- `src/app/admin/reports/page.tsx:118`
- `src/app/api/mpesa/stk-push/route.ts:51` — order description sent to Daraja
- `src/app/api/admin/analyze-quote/route.ts:53` — AI system prompt
- `src/lib/email/resend.ts:13,17,21,22,28,94,96,97` — every transactional email subject/body
- `src/lib/demo-data.ts:306,313,446` — product descriptions
- `src/lib/store/demo-store.ts:1081,1104,1198,1221,1432,1532` — notification titles/bodies
- `src/app/supplier/products/page.tsx:25`

**Zero occurrences of the new target name "AMG Online Store" exist anywhere in the repository** — that rename has not been started; every string listed above will need to move from "AMG Stores" → "AMG Online Store" once that work begins.

**Lower-priority legacy naming (not the brand string, but same family of cleanup):**

- `package.json:2` — `"name": "amg-com"` (internal npm identifier, not user-visible, but inconsistent with both "AMG Stores" and "AMG Online Store").
- The `@amg.com` demo/seed email domain (not `amgstores.ai`, the live domain) appears throughout: `README.md:33-40`, `scripts/ensure-demo-users.mjs`, `scripts/ensure-admin-user.mjs`, `scripts/apply-role-schema*.sql`, `scripts/test-*.mjs`, and in application code at `src/lib/store/demo-store.ts:130-137,153-161,167-170,450-455,527-528` and, notably, **on the real production login page**: `src/app/auth/login/page.tsx:69-80` shows the demo credential hints (`admin@amg.com` / `admin123`, etc.) to real visitors. `src/app/contact/page.tsx:33,36` links `mailto:hello@amg.com` (customer-facing, likely not a monitored inbox on the `amgstores.ai` domain), and `src/lib/push/send.ts:17` falls back to `mailto:admin@amg.com` as the VAPID subject if `VAPID_SUBJECT` isn't set.

---

## H. Recommended Improvements

### P0 — Critical
1. **Move checkout pricing server-side.** Replace the direct browser `insert` into `orders`/`order_items` with a single `SECURITY DEFINER` RPC that recomputes every line's price from `products.price_kes`, validates stock, and writes the order + items atomically. Tighten `orders`/`order_items` INSERT RLS so direct table inserts are no longer possible (`supabase/migrations/001_schema.sql:184-186,203-205`, `005_order_place_rls.sql:64-65`). Update `src/app/checkout/page.tsx` and `src/lib/offline/order-queue.ts` to call the RPC.
2. **Verify M-Pesa payment server-side.** Only ever set `orders.paid = true` from the authenticated Daraja callback (`src/app/api/mpesa/callback/route.ts`) against a server-tracked pending record keyed to the order — never from a client-submitted boolean (`checkout/page.tsx:63,181,221`). Validate `amountKes` in `src/app/api/mpesa/stk-push/route.ts:26-33` against the server-computed order total.
3. **Lock down `get_order_confirmation`** (`supabase/migrations/007_payment_delivery_riders.sql:10-59`) to require the caller be the order's owner or an admin, instead of any caller who knows the UUID.
4. **Fix the notifications INSERT policy** (`supabase/migrations/004_supplier_workflow.sql:88-90`) — remove the `or true`; route all notification creation through `SECURITY DEFINER` functions instead of an open client insert.
5. **Build the production path for the supplier order-routing workflow** — `confirmSupplierOrder` in `src/app/admin/orders/page.tsx:135-148` and the entirety of `src/app/supplier/requests/page.tsx` currently only work in demo mode; this is a core marketplace feature that is non-functional in production today.
6. **Add auth checks** to `src/app/api/orders/sms/route.ts`, `src/app/api/orders/email/route.ts`, `src/app/api/admin/select-supplier/route.ts`, `src/app/api/admin/analyze-quote/route.ts` (verify an admin/owning-user session before sending SMS/email or spending OpenAI credits), and verify `userId` in `src/app/api/push/subscribe/route.ts:13-51` against the caller's actual session rather than trusting the request body.

### P1 — High
1. Add file-size and MIME/extension validation before storage upload in `src/components/admin/ProductForm.tsx:117-124,132-136` (cover and gallery images).
2. Wrap the two-step order insert in `src/lib/offline/order-queue.ts:64-67` in a single RPC/transaction (naturally follows from P0-1) so a partial failure can't leave an order with zero items.
3. Add stock validation/decrement to the checkout RPC (from P0-1) to prevent overselling.
4. Add real transition validation to the admin order-status `<select>` in `src/app/admin/orders/page.tsx:507-529`, mirroring the rigor already built into `set_rider_delivery_status`.
5. Add pagination (`.range()`) to the highest-traffic list queries first — `src/app/admin/orders/page.tsx:88-93`, `src/app/admin/products/page.tsx`, and the reports pages under `src/app/admin/reports/*` — before order/product volume grows further.
6. Replace `<img>` with `next/image` for product photography — `src/components/shop/ProductCard.tsx`, `src/components/shop/ProductGallery.tsx`, `src/app/product/[slug]/page.tsx`, `src/app/cart/page.tsx` — for compression and responsive sizing on mobile connections.

### P2 — Medium
1. Extract the duplicated auth-guard/initials/loading logic in `AdminShell.tsx`, `SupplierShell.tsx`, `RiderShell.tsx` into a shared `useRoleGuard(role)` hook plus a shared avatar/footer component.
2. Split `src/lib/store/demo-store.ts` (2,108 lines) into per-domain modules, and consider a single data-access interface that both demo and production implement, so a feature can no longer silently exist in only one mode (root cause of P0-5).
3. Remove or properly gate the `comingSoon` nav items in `src/components/rider/RiderShell.tsx:15-16,22-23` rather than showing riders permanently dead links.
4. Broaden `aria-label`/accessible-name coverage on the large Kanban/report components (`OrderStatusKanban.tsx`, `SupplyKanban.tsx`, `ReportUI.tsx`) — color/icon-only status indicators should carry a text equivalent.
5. Update the `@amg.com` addresses that are customer-facing — `src/app/contact/page.tsx:33,36` and `src/lib/push/send.ts:17` — to the live `amgstores.ai` domain, and update `package.json:2`'s `"name"` field for consistency.
6. Remove the visible demo-credential hints from the real login page, `src/app/auth/login/page.tsx:69-80`, or gate them behind `isDemoMode()` so production visitors never see them (verify — if they're already gated, downgrade this item; if not, this is closer to P1).

### P3 — Nice to have
1. Complete the "AMG Stores" → "AMG Online Store" rename across every file listed in section G once the new name is finalized — currently zero occurrences of the new name exist anywhere in the repo.
2. Replace the plain "Checking … access…" text screens in the three role shells with a skeleton/spinner consistent with the rest of the UI.
3. Add lightweight rate limiting to the endpoints that must remain callable pre-auth (e.g. `mpesa/stk-push`) once P0-6's auth work lands elsewhere, to blunt residual abuse.
