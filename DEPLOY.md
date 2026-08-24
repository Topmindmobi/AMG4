# Deploy AMG Stores

Supabase (Auth, Postgres, Storage) stays **external** for production. Run migrations and seed in your Supabase project before going live — see [README](README.md#supabase-setup-production).

---

## Render (recommended for quick deploys)

Blueprint file: [`render.yaml`](render.yaml).

### One-time setup

1. Push this repo to GitHub (branch `claude/marketplace-feature-expansion` or update `branch` in `render.yaml`).
2. Open [Render Blueprints](https://dashboard.render.com/blueprints) → **New Blueprint Instance**.
3. Connect the **Topmindmobi/AMG4** GitHub repo and select the branch that contains `render.yaml`.
4. Render will prompt for optional secrets (`sync: false` vars). You can leave them blank — the Blueprint defaults to `NEXT_PUBLIC_DEMO_MODE=true` so the app runs without Supabase.
5. Click **Apply** / **Deploy Blueprint**.
6. When the deploy finishes, open the `*.onrender.com` URL.

Free web services on Render sleep after idle traffic; the first request after sleep can take ~30–60s.

### Switch to production (Supabase)

In the Render service → **Environment**:

- `NEXT_PUBLIC_DEMO_MODE` = `false`
- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Redeploy (required — `NEXT_PUBLIC_*` are baked in at build time)
- Add the Render URL to Supabase Auth redirect allow-list

### Native Node vs Docker

The Blueprint uses Render’s **Node** runtime (`npm ci && npm run build` / `npm start`). The root [`Dockerfile`](Dockerfile) remains available for DigitalOcean or a Docker-based Render service if you prefer.

---

## DigitalOcean

Spec: [`.do/app.yaml`](.do/app.yaml) → GitHub repo **`Topmindmobi/AMG4`**, branch **`main`**, Dockerfile, port **3000**.

Live app (existing): https://amg-com-2j9zz.ondigitalocean.app

### Update an existing App Platform app

1. Push latest code to `main` on GitHub.
2. In [DigitalOcean Apps](https://cloud.digitalocean.com/apps) → **amg-com** → **Settings**:
   - Source: repo `Topmindmobi/AMG4`, branch `main`, autodeploy on
   - Or **Actions → Force Rebuild / Deploy**
3. Ensure `NEXT_PUBLIC_DEMO_MODE=true` for demo, or `false` + Supabase secrets for production (**Run and build time** for all `NEXT_PUBLIC_*`).

### CLI (`doctl`)

```bash
# Windows typical path: %LOCALAPPDATA%\doctl\doctl.exe
doctl auth init
doctl apps list
doctl apps update <APP_ID> --spec .do/app.yaml
doctl apps create-deployment <APP_ID>
```

`doctl` is optional. If it is not authenticated, use the App Platform UI above.

## Environment variables (App Platform / Docker)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (prod) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (prod) | Supabase anon (public) key |
| `NEXT_PUBLIC_DEMO_MODE` | Yes | Set to `false` in production |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Optional; server/admin helpers only — never expose to the client |
| `TWILIO_ACCOUNT_SID` | No* | Twilio Account SID — SMS on order confirmed / dispatched / delivered |
| `TWILIO_AUTH_TOKEN` | No* | Twilio Auth Token (**Run time** only — never bake into client) |
| `TWILIO_PHONE_NUMBER` | No* | Twilio sender number in E.164 (e.g. `+254…`), **or** set Messaging Service SID |
| `TWILIO_MESSAGING_SERVICE_SID` | No | Optional alternative to `TWILIO_PHONE_NUMBER` |
| `RESEND_API_KEY` | No* | Resend API key — email on the same order events as SMS |
| `EMAIL_FROM` | No* | Sender address, e.g. `"AMG Stores <orders@yourdomain.com>"` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | No* | Web Push public key (safe to expose) — rider payout alerts |
| `VAPID_PUBLIC_KEY` | No* | Same value as above, read server-side |
| `VAPID_PRIVATE_KEY` | No* | Web Push private key (**Run time** only — never bake into client) |
| `VAPID_SUBJECT` | No | `mailto:` contact for push, e.g. `mailto:admin@yourdomain.com` |
| `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` | No* | Daraja app credentials — real M-Pesa STK push at checkout |
| `MPESA_SHORTCODE` / `MPESA_PASSKEY` | No* | Daraja paybill/till shortcode + passkey |
| `MPESA_CALLBACK_URL` | No* | Must be a publicly reachable HTTPS URL pointing at `/api/mpesa/callback` |
| `MPESA_ENV` | No | `sandbox` (default) or `production` |

\*Soft-fail by design: SMS, email, push, and M-Pesa STK push all degrade gracefully when unconfigured (checkout uses a simulated instant payment confirmation instead of blocking) — nothing here is required to run the app.

`NEXT_PUBLIC_*` values are baked into the client at **build** time. Set them as build-time (or run-and-build-time) env vars on App Platform, or as Docker `--build-arg`s.

Do not put secrets in git, `Dockerfile`, or `.do/app.yaml`.

HTTP port: **3000**.

---

## Option A — App Platform (recommended)

### UI (shortest path)

1. Push this repo to GitHub (include `Dockerfile` and `.do/app.yaml`).
2. In [DigitalOcean Apps](https://cloud.digitalocean.com/apps) → **Create App** → connect **GitHub** → select the repo and branch (`main`).
3. App Platform should detect the **Dockerfile**. Confirm **HTTP port `3000`**.
4. Under **Environment Variables**, add:

   - `NEXT_PUBLIC_SUPABASE_URL` — secret, scope **Run and build time**
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — secret, scope **Run and build time**
   - `NEXT_PUBLIC_DEMO_MODE` = `false` — run and build time
   - `SUPABASE_SERVICE_ROLE_KEY` — optional secret, **Run time** only
   - `TWILIO_ACCOUNT_SID` — secret, **Run time** only (order SMS)
   - `TWILIO_AUTH_TOKEN` — secret, **Run time** only
   - `TWILIO_PHONE_NUMBER` — secret, **Run time** only (or `TWILIO_MESSAGING_SERVICE_SID`)
   - `RESEND_API_KEY`, `EMAIL_FROM` — optional secrets, **Run time** only (order email)
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — optional, **Run and build time** (rider push alerts)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — optional secrets, **Run time** only
   - `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_SHORTCODE`, `MPESA_PASSKEY`, `MPESA_CALLBACK_URL` — optional secrets, **Run time** only (real M-Pesa STK push; omit to keep the simulated pay-now flow)

5. Pick a region (spec default: `fra`) and plan → **Create Resources**.
6. After deploy, open the live URL. In Supabase Auth → URL configuration, add your DO app URL to redirect/allow lists.
7. **Domain / SSL**: App Settings → Domains → add a custom domain. App Platform provisions TLS automatically once DNS points at the app.

Edit `.do/app.yaml` and set `github.repo` to your `org/repo` if you deploy from the CLI.

### CLI (`doctl`) — when installed and authenticated

```bash
# Install: https://docs.digitalocean.com/reference/doctl/how-to/install/
doctl auth init
# Edit .do/app.yaml → set github.repo, then:
doctl apps create --spec .do/app.yaml
# Set secret values in the control panel (Settings → App-Level Environment Variables),
# or update the app after create:
# doctl apps update <APP_ID> --spec .do/app.yaml
```

---

## Option B — Droplet + Docker

1. Create a Droplet (Ubuntu) with Docker installed.
2. On the Droplet (or in CI), build with your public Supabase values:

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  --build-arg NEXT_PUBLIC_DEMO_MODE=false \
  -t amg-com .
```

3. Run:

```bash
docker run -d --name amg-com -p 3000:3000 \
  -e NEXT_PUBLIC_DEMO_MODE=false \
  amg-com
```

4. Put **nginx** (or Caddy) in front: proxy `https://your-domain` → `http://127.0.0.1:3000`. Use Certbot or Caddy for SSL.
5. Open firewall for 80/443; keep 3000 bound to localhost if only nginx should reach it.

---

## After deploy checklist

- [ ] Supabase migrations + seed applied
- [ ] Admin user created and role set in `profiles`
- [ ] `NEXT_PUBLIC_DEMO_MODE=false` and real Supabase URL/anon key at build time
- [ ] Auth redirect URLs include the production domain
- [ ] Custom domain + SSL (App Platform: Domains tab; Droplet: nginx/Caddy + Certbot)
- [ ] Twilio SMS (optional): set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` (or Messaging Service SID) as **Run time** secrets so buyers get SMS on confirm, dispatch, and delivery
- [ ] Email (optional): set `RESEND_API_KEY` and `EMAIL_FROM` so buyers who gave an email get the same updates
- [ ] Rider push alerts (optional): set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` so riders can enable payout push notifications
- [ ] Real M-Pesa pay-now (optional): set `MPESA_CONSUMER_KEY` / `MPESA_CONSUMER_SECRET` / `MPESA_SHORTCODE` / `MPESA_PASSKEY` / `MPESA_CALLBACK_URL` — without these, checkout uses a simulated instant confirmation

## Local Docker smoke test

```bash
docker build \
  --build-arg NEXT_PUBLIC_DEMO_MODE=true \
  -t amg-com .
docker run --rm -p 3000:3000 -e NEXT_PUBLIC_DEMO_MODE=true amg-com
```
